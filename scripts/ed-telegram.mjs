#!/usr/bin/env node

/**
 * Ed Telegram Bridge
 *
 * Ed is the orchestrator agent for Mission Control.
 * Polls Telegram directly via getUpdates (long polling), processes messages
 * through Claude CLI as Ed, executes MC actions, responds on Telegram,
 * and stores conversation history in mc_telegram_messages.
 *
 * Managed by launchd: com.missioncontrol.ed-telegram
 *
 * Architecture:
 *   Telegram getUpdates → this script → Claude CLI → actions + response → Telegram
 *   All messages stored in mc_telegram_messages for audit + conversation context
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

// ── Config ──────────────────────────────────────────────────────────────

const ENV_PATH = resolve(process.cwd(), ".env.local");
const MAX_HISTORY = 20; // messages to include in conversation context
const CLAUDE_CLI = "/opt/homebrew/bin/claude";
const GEMINI_CLI = "/opt/homebrew/bin/gemini";
const CODEX_CLI = "/opt/homebrew/bin/codex";
const ENGINE_TIMEOUT = { claude: 300_000, gemini: 300_000, codex: 300_000 };

// Engine priority — loaded from mc_settings, refreshed periodically
let enginePriority = ["claude", "gemini", "codex"];
let claudeQuotaUntil = 0; // Timestamp when Claude quota resets (0 = not throttled)

// ── Load .env.local ─────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(ENV_PATH, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    log(`WARN: could not load ${ENV_PATH}: ${err.message}`);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
  );
  process.exit(1);
}
if (!BOT_TOKEN) {
  console.error("FATAL: TELEGRAM_BOT_TOKEN must be set");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── State ───────────────────────────────────────────────────────────────

let running = true;
let processing = false;
let lastUpdateId = 0; // Telegram update offset for getUpdates

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Helpers ─────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`${new Date().toISOString()} [ed-telegram] ${msg}`);
}

// ── Ed's System Prompt (via API) ────────────────────────────────────────

const MC_BASE_URL = process.env.MC_SERVER_URL || "http://localhost:3000";
const MC_RUNNER_TOKEN = process.env.MC_RUNNER_TOKEN || "";

async function getSystemPrompt() {
  const res = await fetch(`${MC_BASE_URL}/api/ed/system-prompt`, {
    headers: { "x-runner-token": MC_RUNNER_TOKEN },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok)
    throw new Error(`System prompt API ${res.status}: ${await res.text()}`);
  const { prompt } = await res.json();
  return prompt;
}

// ── Engine Config ──────────────────────────────────────────────────────

async function loadEngineConfig() {
  try {
    const res = await fetch(`${MC_BASE_URL}/api/ed/engine-config`, {
      headers: { "x-runner-token": MC_RUNNER_TOKEN },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const config = await res.json();
      if (config.engine_priority) enginePriority = config.engine_priority;
      if (config.claude_quota_until)
        claudeQuotaUntil = config.claude_quota_until;
    }
  } catch {
    /* use defaults */
  }
}

async function setQuotaFlag(until) {
  try {
    await fetch(`${MC_BASE_URL}/api/ed/engine-config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-runner-token": MC_RUNNER_TOKEN,
      },
      body: JSON.stringify({ claude_quota_until: until }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    /* non-critical */
  }
}

// ── Conversation History ────────────────────────────────────────────────

async function loadHistory(chatId) {
  const { data } = await sb
    .from("mc_telegram_messages")
    .select("role, from_name, content, created_at")
    .eq("chat_id", chatId)
    .in("status", ["replied", "sent"])
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);

  // Reverse to chronological order
  return (data || []).reverse();
}

function formatHistory(history) {
  if (!history.length) return "";
  const lines = history.map((m) => {
    const name = m.role === "user" ? "David" : "Ed";
    return `${name}: ${m.content}`;
  });
  return "\n## Recent Conversation\n" + lines.join("\n") + "\n";
}

// ── Engine CLI ──────────────────────────────────────────────────────────

function callEngine(engine, systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    let proc;
    const timeout = ENGINE_TIMEOUT[engine] || 300_000;
    const env = { ...process.env };
    delete env.CLAUDECODE; // Required for nested CLI calls

    let stdinMessage = userMessage;

    if (engine === "claude") {
      proc = spawn(
        CLAUDE_CLI,
        [
          "-p",
          "--permission-mode",
          "bypassPermissions",
          "--system-prompt",
          systemPrompt,
        ],
        { env, stdio: ["pipe", "pipe", "pipe"] },
      );
    } else if (engine === "gemini") {
      // Gemini: system prompt prepended to user message via -p flag
      const fullMessage = `<system>\n${systemPrompt}\n</system>\n\n${userMessage}`;
      proc = spawn(GEMINI_CLI, ["-p", fullMessage, "--approval-mode", "yolo"], {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      stdinMessage = null; // Gemini takes prompt via -p flag, no stdin
    } else if (engine === "codex") {
      // Codex: exec subcommand, combined prompt via stdin
      const fullMessage = `System instructions:\n${systemPrompt}\n\n---\n\n${userMessage}`;
      proc = spawn(
        CODEX_CLI,
        ["exec", "--full-auto", "--skip-git-repo-check"],
        { env, stdio: ["pipe", "pipe", "pipe"] },
      );
      stdinMessage = fullMessage;
    } else {
      reject(new Error(`Unknown engine: ${engine}`));
      return;
    }

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`${engine} CLI timed out after ${timeout / 1000}s`));
    }, timeout);

    if (stdinMessage !== null) {
      proc.stdin.write(stdinMessage);
    }
    proc.stdin.end();

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d;
    });
    proc.stderr.on("data", (d) => {
      stderr += d;
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.length > 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(`${engine} CLI exited ${code}: ${stderr.slice(0, 500)}`),
        );
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function isQuotaError(errorMsg) {
  return /rate.?limit|429|quota|too many|capacity|overloaded|throttl/i.test(
    errorMsg,
  );
}

// ── Response Parsing ────────────────────────────────────────────────────

function parseResponse(text) {
  const actionRegex = /\[MC_ACTION:(\w+)\](.*?)\[\/MC_ACTION\]/gs;
  const actions = [];
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      actions.push({
        type: match[1],
        params: JSON.parse(match[2]),
      });
    } catch {
      log(`WARN: invalid action JSON: ${match[2].slice(0, 100)}`);
    }
  }

  // Remove action markers from text David sees
  const cleanText = text
    .replace(actionRegex, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: cleanText, actions };
}

// ── Action Execution (via API) ──────────────────────────────────────────

async function executeActions(actions) {
  if (!actions.length) return [];
  try {
    const res = await fetch(`${MC_BASE_URL}/api/ed/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-runner-token": MC_RUNNER_TOKEN,
      },
      body: JSON.stringify({ actions }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text();
      log(`Actions API error ${res.status}: ${text.slice(0, 200)}`);
      return actions.map((a) => ({
        type: a.type,
        ok: false,
        error: `API ${res.status}`,
      }));
    }
    const { results } = await res.json();
    for (const r of results) {
      log(
        `ACTION: ${r.type} → ${r.ok ? "ok" : "FAIL"}${r.job_id ? ` job=${r.job_id}` : ""}${r.id ? ` id=${r.id}` : ""}${r.error ? ` err=${r.error}` : ""}`,
      );
    }
    return results;
  } catch (err) {
    log(`Actions API call failed: ${err.message}`);
    return actions.map((a) => ({
      type: a.type,
      ok: false,
      error: err.message,
    }));
  }
}

// ── Telegram API ────────────────────────────────────────────────────────

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !text) return;

  // Telegram message limit is 4096 chars — split if needed
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 4096) {
      chunks.push(remaining);
      break;
    }
    // Find a good split point
    let splitAt = remaining.lastIndexOf("\n", 4096);
    if (splitAt < 2000) splitAt = 4096;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown",
      }),
    }).catch(async () => {
      // Fallback: send without Markdown if parsing fails
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      }).catch(() => {});
    });
  }
}

async function sendChatAction(chatId, action) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

// ── Message Processing ──────────────────────────────────────────────────

async function processMessage(msg) {
  const startTime = Date.now();
  log(
    `processing message from ${msg.from_name}: "${(msg.content || "").slice(0, 80)}..."`,
  );

  // 1. Mark as processing
  await sb
    .from("mc_telegram_messages")
    .update({ status: "processing" })
    .eq("id", msg.id);

  // 2. Send typing indicator
  await sendChatAction(msg.chat_id, "typing");

  try {
    // 3. Load conversation history + system prompt in parallel
    const [history, systemPrompt] = await Promise.all([
      loadHistory(msg.chat_id),
      getSystemPrompt(),
    ]);
    const historyText = formatHistory(history);

    // 4. Build user message with history
    let userMessage = "";
    if (historyText) {
      userMessage += historyText + "\n";
    }
    userMessage += `David: ${msg.content || "(empty message)"}`;

    // Add URL metadata if present
    const urls = msg.metadata?.urls;
    if (urls?.length) {
      userMessage += `\n\n[Shared URLs: ${urls.join(", ")}]`;
    }
    if (msg.photo_file_id) {
      userMessage += "\n\n[David shared a photo]";
    }

    userMessage += "\n\nRespond as Ed:";

    // 7. Refresh typing indicator periodically during engine call
    const typingInterval = setInterval(() => {
      sendChatAction(msg.chat_id, "typing");
    }, 4_000);

    // 8. Try engines in priority order with fallback
    let rawResponse;
    let engineUsed = null;
    let lastError = null;

    try {
      for (const engine of enginePriority) {
        if (engine === "claude" && claudeQuotaUntil > Date.now()) {
          log(
            `skipping claude (quota exhausted until ${new Date(claudeQuotaUntil).toISOString()})`,
          );
          continue;
        }
        try {
          log(`trying engine: ${engine}`);
          rawResponse = await callEngine(engine, systemPrompt, userMessage);
          engineUsed = engine;
          break;
        } catch (err) {
          lastError = err;
          log(`${engine} failed: ${err.message}`);

          if (engine === "claude" && isQuotaError(err.message)) {
            // Set 1-hour cooldown on Claude (rolling window resets gradually)
            claudeQuotaUntil = Date.now() + 60 * 60 * 1000;
            log(`claude quota detected — cooling off for 1h`);
            // Persist to mc_settings so job scheduler knows too
            setQuotaFlag(claudeQuotaUntil);
          }
          continue;
        }
      }

      if (!rawResponse) {
        throw lastError || new Error("All engines failed");
      }
    } finally {
      clearInterval(typingInterval);
    }

    // 9. Parse response and extract actions
    const { text, actions } = parseResponse(rawResponse);

    // 10. Execute MC actions
    let actionResults = [];
    if (actions.length > 0) {
      actionResults = await executeActions(actions);
      log(
        `executed ${actions.length} actions: ${actionResults.map((a) => `${a.type}:${a.ok}`).join(", ")}`,
      );
    }

    // 11. Send response to Telegram
    await sendTelegram(msg.chat_id, text);

    // 12. Store Ed's response with engine tracking
    await sb.from("mc_telegram_messages").insert({
      chat_id: msg.chat_id,
      from_name: "ed",
      role: "assistant",
      content: text,
      status: "sent",
      actions_taken: actionResults,
      metadata: { engine_used: engineUsed },
    });

    // 13. Mark original as replied
    await sb
      .from("mc_telegram_messages")
      .update({ status: "replied" })
      .eq("id", msg.id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`replied in ${elapsed}s via ${engineUsed} (${actions.length} actions)`);
  } catch (err) {
    log(`ERROR processing message ${msg.id}: ${err.message}`);

    // Mark as error
    await sb
      .from("mc_telegram_messages")
      .update({ status: "error", error_message: err.message })
      .eq("id", msg.id);

    // Send error to David with context-specific message
    const isTimeout = err.message.includes("timed out");
    const errorMsg = isTimeout
      ? `⚡ That one took too long (>3 min). Try breaking it into smaller messages or I'll pick it up on a shorter prompt.`
      : `⚠️ Hit a snag: ${err.message.slice(0, 200)}\n\nI'll keep going on the next message.`;
    await sendTelegram(msg.chat_id, errorMsg);
  }
}

// ── Notification Delivery ────────────────────────────────────────────────

async function deliverNotifications() {
  try {
    // Find pending notifications not yet delivered via Telegram
    const { data: notifications } = await sb
      .from("mc_ed_notifications")
      .select("id, title, body, category, priority, metadata")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(10);

    if (!notifications?.length) return;

    // Only send important notifications to Telegram — silently acknowledge the rest
    // David gets: decisions, approvals, urgent alerts, deploy-ready, reminders
    // David does NOT get: routine job completions, job failures, info messages
    const TELEGRAM_CATEGORIES = new Set([
      "decision_needed",
      "approval_needed",
      "deploy_ready",
      "alert",
      "reminder",
    ]);

    // Urgent priority always gets through regardless of category
    const shouldSendToTelegram = (notif) =>
      notif.priority === "urgent" || TELEGRAM_CATEGORIES.has(notif.category);

    // Find David's chat ID from recent messages (only if we have something to send)
    const hasDeliverable = notifications.some(shouldSendToTelegram);
    let chatId = null;

    if (hasDeliverable) {
      const { data: recentMsg } = await sb
        .from("mc_telegram_messages")
        .select("chat_id")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      chatId = recentMsg?.chat_id;
    }

    for (const notif of notifications) {
      if (shouldSendToTelegram(notif) && chatId) {
        // Important notification — send to David on Telegram
        const icon =
          {
            decision_needed: "🤔",
            approval_needed: "✋",
            deploy_ready: "🚀",
            alert: "⚠️",
            reminder: "🔔",
          }[notif.category] || "📌";

        let text = `${icon} *${notif.title}*`;
        if (notif.body) text += `\n${notif.body.slice(0, 300)}`;

        if (notif.priority === "urgent") {
          text = `🔴 URGENT\n${text}`;
        }

        await sendTelegram(chatId, text);

        await sb
          .from("mc_ed_notifications")
          .update({
            status: "delivered",
            delivered_via: ["telegram"],
            delivered_at: new Date().toISOString(),
          })
          .eq("id", notif.id);

        log(
          `NOTIFICATION: sent to Telegram ${notif.id} (${notif.category}/${notif.priority})`,
        );
      } else {
        // Routine notification — silently mark as delivered (visible in dashboard only)
        await sb
          .from("mc_ed_notifications")
          .update({
            status: "delivered",
            delivered_via: ["dashboard"],
            delivered_at: new Date().toISOString(),
          })
          .eq("id", notif.id);

        log(
          `NOTIFICATION: dashboard-only ${notif.id} (${notif.category}/${notif.priority})`,
        );
      }
    }
  } catch (err) {
    // Non-critical — don't log spam
  }
}

// ── Telegram Polling ────────────────────────────────────────────────────

async function getUpdates() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);

    const res = await fetch(
      `${TG_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=["message"]`,
      {
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      log(`getUpdates HTTP ${res.status}`);
      return [];
    }

    const body = await res.json();
    if (!body.ok) return [];

    return body.result || [];
  } catch (err) {
    if (err.name !== "AbortError") {
      log(`getUpdates error: ${err.message}`);
    }
    return [];
  }
}

function extractMessage(update) {
  const message = update.message;
  if (!message) return null;

  const text = message.text?.trim() || message.caption?.trim() || "";
  const from = message.from?.first_name || "david";
  const chatId = message.chat.id;

  // Extract metadata
  const metadata = {};
  const urls = text.match(/https?:\/\/[^\s]+/g);
  if (urls) metadata.urls = urls;
  if (message.photo?.length > 0) {
    metadata.photo = message.photo[message.photo.length - 1];
  }
  if (message.document) metadata.document = message.document;

  return {
    chat_id: chatId,
    message_id: message.message_id,
    from_name: from.toLowerCase(),
    content: text,
    photo_file_id: message.photo?.[message.photo.length - 1]?.file_id || null,
    metadata,
  };
}

// ── Main Loop ───────────────────────────────────────────────────────────

async function loop() {
  log("started — Ed Telegram bridge is live (direct polling)");
  log(`CLIs: claude=${CLAUDE_CLI} gemini=${GEMINI_CLI} codex=${CODEX_CLI}`);

  await loadEngineConfig();
  log(`engine priority: ${enginePriority.join(" → ")}`);
  let lastConfigLoad = Date.now();

  while (running) {
    // Refresh engine config every 5 minutes
    if (Date.now() - lastConfigLoad > 5 * 60 * 1000) {
      await loadEngineConfig();
      lastConfigLoad = Date.now();
    }

    try {
      // 1. Long-poll Telegram for new messages
      const updates = await getUpdates();

      for (const update of updates) {
        lastUpdateId = update.update_id;

        const msg = extractMessage(update);
        if (!msg || !msg.content) continue;

        // 2. Store incoming message in DB for audit + history
        const { data: stored } = await sb
          .from("mc_telegram_messages")
          .insert({
            chat_id: msg.chat_id,
            message_id: msg.message_id,
            from_name: msg.from_name,
            role: "user",
            content: msg.content,
            photo_file_id: msg.photo_file_id,
            status: "pending",
            metadata: msg.metadata,
          })
          .select("id, chat_id, content, from_name, photo_file_id, metadata")
          .single();

        if (!stored) continue;

        // 3. Process through Ed
        await processMessage(stored);
      }

      // 4. Deliver pending notifications to David via Telegram
      await deliverNotifications();
    } catch (err) {
      log(`LOOP ERROR: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000)); // back off on error
    }
  }

  log("stopped");
}

// ── Graceful Shutdown ───────────────────────────────────────────────────

process.on("SIGTERM", () => {
  log("SIGTERM received");
  running = false;
});
process.on("SIGINT", () => {
  log("SIGINT received");
  running = false;
});

loop();
