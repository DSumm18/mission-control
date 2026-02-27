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

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// ── Config ──────────────────────────────────────────────────────────────

const ENV_PATH       = resolve(process.cwd(), '.env.local');
const MAX_HISTORY    = 20;             // messages to include in conversation context
const CLAUDE_CLI     = '/opt/homebrew/bin/claude';
const CLAUDE_TIMEOUT = 180_000;        // 180s max per response

// ── Load .env.local ─────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(ENV_PATH, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
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
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}
if (!BOT_TOKEN) {
  console.error('FATAL: TELEGRAM_BOT_TOKEN must be set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── State ───────────────────────────────────────────────────────────────

let running = true;
let processing = false;
let lastUpdateId = 0;  // Telegram update offset for getUpdates

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Helpers ─────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`${new Date().toISOString()} [ed-telegram] ${msg}`);
}

// ── Ed's System Prompt ──────────────────────────────────────────────────

function buildSystemPrompt(contextBlock) {
  return `You are Ed, the orchestrator agent for Mission Control — David Summers' AI operations platform.

## Who You Are
- David's right-hand AI assistant — think Jarvis, but for EdTech.
- You coordinate a team of specialist agents: Scout, Hawk, Megaphone, Builder, Inspector, Publisher, Pixel, Pulse.
- You're direct, proactive, and efficient. No waffle.
- You communicate like a sharp colleague, not a corporate chatbot.

## What You Know
- **Schoolgle**: EdTech platform for UK schools. Weekly newsletter "The Schoolgle Signal" for heads, SBMs, governors, DSLs.
- **DfE Data Warehouse**: 307K+ school records from Department for Education (in Schoolgle's separate Supabase).
- **Product Portfolio**: MyMeme, MySongs, Schoolgle, DealFind, CricBook, ClawPhone.
- **Revenue target**: £10K/month by end March 2026.
- **Newsletter model**: Free basic tool in newsletter, full pro tool in Schoolgle Toolbox (paid tier). Articles tease upgrade.

## Your Agent Team
- **Scout**: Research — finds, summarises, scores content relevance 1-10
- **Hawk**: Deep analysis — policy context, cross-references, implications for schools
- **Megaphone**: Writer — newsletter sections in Schoolgle voice, social copy
- **Builder**: Tool creator — interactive tools/snippets for newsletters
- **Inspector**: QA — voice check, accuracy, AI-phrase detection
- **Publisher**: Deployment — GitHub Pages, releases
- **Pixel**: Design — visual assets, branding
- **Pulse**: Data analyst — DfE data insights, trends, projections

## How to Respond
- SHORT and punchy. This is Telegram, not an essay. 2-4 sentences for most replies.
- Emojis: use sparingly but effectively (✅ 🔍 📰 🎯 ⚡).
- If David shares a URL → assess what it's useful for, suggest newsletter angles.
- If David shares an idea → help develop it, suggest next steps.
- If you need clarification → ask ONE focused question.
- When delegating to an agent → explain what + why in one line.
- Be proactive — suggest connections and actions David hasn't thought of.

## Actions
When you need to execute something in Mission Control, include action blocks in your response.
Use this EXACT format — each on its own line:

[MC_ACTION:create_research]{"url":"...","title":"...","content_type":"article","notes":"..."}[/MC_ACTION]

[MC_ACTION:queue_scout]{"research_item_id":"...","title":"...","url":"...","content_type":"article"}[/MC_ACTION]

[MC_ACTION:queue_hawk]{"research_item_id":"...","focus":"..."}[/MC_ACTION]

[MC_ACTION:create_task]{"title":"...","description":"..."}[/MC_ACTION]

[MC_ACTION:queue_draft]{"newsletter_id":"..."}[/MC_ACTION]

Available content_types: article, youtube, govuk, pdf, social, manual

Only include actions when you need to DO something. Not for casual chat.
When creating research from a shared URL, ALWAYS create_research first, then queue_scout.

${contextBlock}`;
}

// ── MC Context (live state) ─────────────────────────────────────────────

async function buildContextBlock() {
  let ctx = '\n## Current MC State\n';

  try {
    const { data: newsletters } = await sb
      .from('mc_newsletters')
      .select('id, week_no, title, pipeline_status')
      .order('week_no', { ascending: false })
      .limit(3);

    if (newsletters?.length) {
      ctx += 'Newsletters:\n';
      for (const n of newsletters) {
        ctx += `- Week ${n.week_no}: "${n.title}" [${n.pipeline_status}] (id: ${n.id})\n`;
      }
    }

    const { data: research } = await sb
      .from('mc_research_items')
      .select('id, title, status, relevance_score, content_type')
      .in('status', ['captured', 'assessing', 'assessed'])
      .order('created_at', { ascending: false })
      .limit(8);

    if (research?.length) {
      ctx += '\nPending Research:\n';
      for (const r of research) {
        ctx += `- [${r.status}] ${r.title || '(untitled)'} (${r.content_type}, score: ${r.relevance_score || '?'}/10, id: ${r.id})\n`;
      }
    }

    const { data: jobs } = await sb
      .from('mc_jobs')
      .select('id, title, status, engine')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (jobs?.length) {
      ctx += '\nActive Jobs:\n';
      for (const j of jobs) {
        ctx += `- [${j.status}] ${j.title} (${j.engine})\n`;
      }
    }
  } catch (err) {
    ctx += `(Error loading state: ${err.message})\n`;
  }

  return ctx;
}

// ── Conversation History ────────────────────────────────────────────────

async function loadHistory(chatId) {
  const { data } = await sb
    .from('mc_telegram_messages')
    .select('role, from_name, content, created_at')
    .eq('chat_id', chatId)
    .in('status', ['replied', 'sent'])
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  // Reverse to chronological order
  return (data || []).reverse();
}

function formatHistory(history) {
  if (!history.length) return '';
  const lines = history.map(m => {
    const name = m.role === 'user' ? 'David' : 'Ed';
    return `${name}: ${m.content}`;
  });
  return '\n## Recent Conversation\n' + lines.join('\n') + '\n';
}

// ── Claude CLI ──────────────────────────────────────────────────────────

function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--system-prompt', systemPrompt];
    // Unset CLAUDECODE to allow nested CLI calls from launchd
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const proc = spawn(CLAUDE_CLI, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Claude CLI timed out after ' + (CLAUDE_TIMEOUT / 1000) + 's'));
    }, CLAUDE_TIMEOUT);

    proc.stdin.write(userMessage);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.length > 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Claude CLI exited ${code}: ${stderr.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
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
  const cleanText = text.replace(actionRegex, '').replace(/\n{3,}/g, '\n\n').trim();

  return { text: cleanText, actions };
}

// ── Action Execution ────────────────────────────────────────────────────

async function executeActions(actions, chatId) {
  const results = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_research': {
          const p = action.params;
          const { data, error } = await sb
            .from('mc_research_items')
            .upsert({
              source_url: p.url,
              title: p.title || null,
              content_type: p.content_type || 'article',
              shared_by: 'david',
              status: 'captured',
              why_relevant: p.notes || null,
            }, { onConflict: 'source_url' })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'create_research', id: data.id, ok: true });
          log(`ACTION: created research item ${data.id} for ${p.url}`);
          break;
        }

        case 'queue_scout': {
          const p = action.params;
          // Find Scout agent
          const { data: scout } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Scout')
            .single();

          // Find or use provided research item
          let researchId = p.research_item_id;
          if (!researchId && p.url) {
            const { data: ri } = await sb
              .from('mc_research_items')
              .select('id')
              .eq('source_url', p.url)
              .single();
            researchId = ri?.id;
          }

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Assess: ${p.title || p.url || 'Research item'}`,
              prompt_text: `Assess this content for the Schoolgle Signal newsletter. URL: ${p.url || 'N/A'}. Content type: ${p.content_type || 'article'}. Summarise the key points, score relevance 1-10 for UK school leaders, suggest a newsletter angle, and explain WHY it matters.`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: scout?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;

          // Update research item status
          if (researchId) {
            await sb.from('mc_research_items')
              .update({ assessment_job_id: job.id, status: 'assessing' })
              .eq('id', researchId);
          }

          results.push({ type: 'queue_scout', job_id: job.id, ok: true });
          log(`ACTION: queued Scout job ${job.id}`);
          break;
        }

        case 'queue_hawk': {
          const p = action.params;
          const { data: hawk } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Hawk')
            .single();

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Deep Dive: ${p.focus || 'Analysis'}`,
              prompt_text: `Deep analysis for Schoolgle Signal: ${p.focus || 'General analysis'}. Provide policy context, cross-references with DfE data, implications for UK school leaders, and actionable recommendations.${p.research_item_id ? ` Research item: ${p.research_item_id}` : ''}`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: hawk?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'queue_hawk', job_id: job.id, ok: true });
          log(`ACTION: queued Hawk job ${job.id}`);
          break;
        }

        case 'create_task': {
          const p = action.params;
          const { data: task, error } = await sb
            .from('mc_tasks')
            .insert({
              title: p.title,
              description: p.description || '',
              status: 'todo',
              priority: p.priority || 5,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'create_task', task_id: task.id, ok: true });
          log(`ACTION: created task ${task.id}`);
          break;
        }

        case 'queue_draft': {
          const p = action.params;
          const { data: ed } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Ed')
            .single();

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Generate Draft: Newsletter ${p.newsletter_id}`,
              prompt_text: `Decompose newsletter ${p.newsletter_id} into sections. Review approved research items and generate a draft plan with sections: headline, lead_story, data_snapshot, tool_spotlight, policy_watch, quick_wins, week_ahead.`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: ed?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'queue_draft', job_id: job.id, ok: true });
          log(`ACTION: queued draft generation job ${job.id}`);
          break;
        }

        default:
          log(`WARN: unknown action type: ${action.type}`);
      }
    } catch (err) {
      log(`ERROR executing action ${action.type}: ${err.message}`);
      results.push({ type: action.type, ok: false, error: err.message });
    }
  }

  return results;
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
    let splitAt = remaining.lastIndexOf('\n', 4096);
    if (splitAt < 2000) splitAt = 4096;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      }),
    }).catch(async () => {
      // Fallback: send without Markdown if parsing fails
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      }).catch(() => {});
    });
  }
}

async function sendChatAction(chatId, action) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

// ── Message Processing ──────────────────────────────────────────────────

async function processMessage(msg) {
  const startTime = Date.now();
  log(`processing message from ${msg.from_name}: "${(msg.content || '').slice(0, 80)}..."`);

  // 1. Mark as processing
  await sb.from('mc_telegram_messages')
    .update({ status: 'processing' })
    .eq('id', msg.id);

  // 2. Send typing indicator
  await sendChatAction(msg.chat_id, 'typing');

  try {
    // 3. Load conversation history
    const history = await loadHistory(msg.chat_id);
    const historyText = formatHistory(history);

    // 4. Build live MC context
    const contextBlock = await buildContextBlock();

    // 5. Build system prompt with context
    const systemPrompt = buildSystemPrompt(contextBlock);

    // 6. Build user message with history
    let userMessage = '';
    if (historyText) {
      userMessage += historyText + '\n';
    }
    userMessage += `David: ${msg.content || '(empty message)'}`;

    // Add URL metadata if present
    const urls = msg.metadata?.urls;
    if (urls?.length) {
      userMessage += `\n\n[Shared URLs: ${urls.join(', ')}]`;
    }
    if (msg.photo_file_id) {
      userMessage += '\n\n[David shared a photo]';
    }

    userMessage += '\n\nRespond as Ed:';

    // 7. Refresh typing indicator periodically during Claude call
    const typingInterval = setInterval(() => {
      sendChatAction(msg.chat_id, 'typing');
    }, 4_000);

    // 8. Call Claude CLI
    let rawResponse;
    try {
      rawResponse = await callClaude(systemPrompt, userMessage);
    } finally {
      clearInterval(typingInterval);
    }

    // 9. Parse response and extract actions
    const { text, actions } = parseResponse(rawResponse);

    // 10. Execute MC actions
    let actionResults = [];
    if (actions.length > 0) {
      actionResults = await executeActions(actions, msg.chat_id);
      log(`executed ${actions.length} actions: ${actionResults.map(a => `${a.type}:${a.ok}`).join(', ')}`);
    }

    // 11. Send response to Telegram
    await sendTelegram(msg.chat_id, text);

    // 12. Store Ed's response
    await sb.from('mc_telegram_messages').insert({
      chat_id: msg.chat_id,
      from_name: 'ed',
      role: 'assistant',
      content: text,
      status: 'sent',
      actions_taken: actionResults,
    });

    // 13. Mark original as replied
    await sb.from('mc_telegram_messages')
      .update({ status: 'replied' })
      .eq('id', msg.id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`replied in ${elapsed}s (${actions.length} actions)`);

  } catch (err) {
    log(`ERROR processing message ${msg.id}: ${err.message}`);

    // Mark as error
    await sb.from('mc_telegram_messages')
      .update({ status: 'error', error_message: err.message })
      .eq('id', msg.id);

    // Send error to David with context-specific message
    const isTimeout = err.message.includes('timed out');
    const errorMsg = isTimeout
      ? `⚡ That one took too long (>3 min). Try breaking it into smaller messages or I'll pick it up on a shorter prompt.`
      : `⚠️ Hit a snag: ${err.message.slice(0, 200)}\n\nI'll keep going on the next message.`;
    await sendTelegram(msg.chat_id, errorMsg);
  }
}

// ── Job Completion Notifier ─────────────────────────────────────────────

let lastJobCheck = new Date().toISOString();

async function checkCompletedJobs() {
  try {
    // Find jobs completed since last check that were queued by Ed actions
    const { data: completedJobs } = await sb
      .from('mc_jobs')
      .select('id, title, status, result, updated_at')
      .in('status', ['done', 'failed'])
      .gt('updated_at', lastJobCheck)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (!completedJobs?.length) return;
    lastJobCheck = new Date().toISOString();

    // Find David's chat ID from recent messages
    const { data: recentMsg } = await sb
      .from('mc_telegram_messages')
      .select('chat_id')
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentMsg?.chat_id) return;

    for (const job of completedJobs) {
      const icon = job.status === 'done' ? '✅' : '❌';
      const resultPreview = job.result
        ? (typeof job.result === 'string' ? job.result : JSON.stringify(job.result)).slice(0, 200)
        : '';
      await sendTelegram(recentMsg.chat_id,
        `${icon} Job complete: *${job.title}*\n${resultPreview ? `\n${resultPreview}` : ''}`
      );
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

    const res = await fetch(`${TG_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=["message"]`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      log(`getUpdates HTTP ${res.status}`);
      return [];
    }

    const body = await res.json();
    if (!body.ok) return [];

    return body.result || [];
  } catch (err) {
    if (err.name !== 'AbortError') {
      log(`getUpdates error: ${err.message}`);
    }
    return [];
  }
}

function extractMessage(update) {
  const message = update.message;
  if (!message) return null;

  const text = message.text?.trim() || message.caption?.trim() || '';
  const from = message.from?.first_name || 'david';
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
  log('started — Ed Telegram bridge is live (direct polling)');
  log(`Claude CLI: ${CLAUDE_CLI}`);

  while (running) {
    try {
      // 1. Long-poll Telegram for new messages
      const updates = await getUpdates();

      for (const update of updates) {
        lastUpdateId = update.update_id;

        const msg = extractMessage(update);
        if (!msg || !msg.content) continue;

        // 2. Store incoming message in DB for audit + history
        const { data: stored } = await sb.from('mc_telegram_messages').insert({
          chat_id: msg.chat_id,
          message_id: msg.message_id,
          from_name: msg.from_name,
          role: 'user',
          content: msg.content,
          photo_file_id: msg.photo_file_id,
          status: 'pending',
          metadata: msg.metadata,
        }).select('id, chat_id, content, from_name, photo_file_id, metadata').single();

        if (!stored) continue;

        // 3. Process through Ed
        await processMessage(stored);
      }

      // 4. Check for completed jobs to proactively notify David
      await checkCompletedJobs();

    } catch (err) {
      log(`LOOP ERROR: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000)); // back off on error
    }
  }

  log('stopped');
}

// ── Graceful Shutdown ───────────────────────────────────────────────────

process.on('SIGTERM', () => { log('SIGTERM received'); running = false; });
process.on('SIGINT',  () => { log('SIGINT received');  running = false; });

loop();
