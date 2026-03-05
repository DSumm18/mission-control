/**
 * Ed Chat SSE endpoint.
 *
 * POST /api/ed/chat
 * Body: { conversation_id, message, images? }
 * Response: SSE stream with text chunks, action results, and done event.
 *
 * Quick-path: Supabase-answerable questions (status checks) bypass LLM entirely.
 * Model routing: Haiku (fast) → Sonnet (complex) → Opus (strategic).
 * All LLM tiers use Claude CLI on Max plan — zero cost.
 */

export const runtime = "nodejs";
export const maxDuration = 600;

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import {
  buildJarvisContext,
  buildPageContext,
  buildEdOpenClawContext,
} from "@/lib/ed/context";
import {
  recordUsage,
  checkTokenBudget,
  estimateTokens,
} from "@/lib/ed/token-budget";
import { openclawStream } from "@/lib/ed/openclaw-stream";
import { parseActions, executeActions } from "@/lib/ed/actions";
import { routeMessage } from "@/lib/ed/model-router";
import type { EdChatRequest, EdStreamChunk, ChatTarget } from "@/lib/ed/types";

function sseEncode(chunk: EdStreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

// Track active Jarvis sessions to detect busy state
const activeSessions = new Map<
  string,
  { startedAt: number; message: string }
>();

/** Quick-path: answer simple status questions from Supabase directly */
async function tryQuickPath(message: string): Promise<string | null> {
  const lower = message.toLowerCase();
  const sb = supabaseAdmin();

  // "what jobs are running" / "job status" / "active jobs"
  if (
    /\b(jobs?|running|queued|active)\b/.test(lower) &&
    /\b(status|what|how|any|running|list)\b/.test(lower)
  ) {
    const { data: jobs } = await sb
      .from("mc_jobs")
      .select("id, title, status, engine, created_at")
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (!jobs?.length)
      return "All clear — no jobs running or queued right now.";

    let response = `**${jobs.length} active job${jobs.length > 1 ? "s" : ""}:**\n`;
    for (const j of jobs) {
      response += `- **${j.title}** [${j.status}] (${j.engine})\n`;
    }
    return response;
  }

  // "newsletter status" / "what's the latest newsletter"
  if (
    /\bnewsletter/.test(lower) &&
    /\b(status|latest|current|progress|where)\b/.test(lower)
  ) {
    const { data: newsletters } = await sb
      .from("mc_newsletters")
      .select("id, week_no, title, pipeline_status")
      .order("week_no", { ascending: false })
      .limit(3);

    if (!newsletters?.length) return "No newsletters found in the system yet.";

    let response = "**Recent newsletters:**\n";
    for (const n of newsletters) {
      response += `- Week ${n.week_no}: "${n.title}" — **${n.pipeline_status}**\n`;
    }
    return response;
  }

  // "research status" / "pending research"
  if (
    /\bresearch/.test(lower) &&
    /\b(status|pending|what|list)\b/.test(lower)
  ) {
    const { data: research } = await sb
      .from("mc_research_items")
      .select("id, title, status, relevance_score, content_type")
      .in("status", ["captured", "assessing", "assessed"])
      .order("created_at", { ascending: false })
      .limit(8);

    if (!research?.length)
      return "Research pipeline is empty — nothing pending.";

    let response = `**${research.length} research item${research.length > 1 ? "s" : ""} in pipeline:**\n`;
    for (const r of research) {
      response += `- [${r.status}] ${r.title || "(untitled)"} (${r.content_type}, score: ${r.relevance_score || "?"}/10)\n`;
    }
    return response;
  }

  // "my tasks" / "what do I need to do" / "pending decisions"
  if (
    /what (do i|should i) need to (do|decide|approve)/i.test(lower) ||
    /what('s| is) (pending|waiting|open)/i.test(lower) ||
    (/\b(my|david'?s?)\b/.test(lower) &&
      /\b(tasks?|decisions?|sign.?offs?)\b/.test(lower)) ||
    (/\b(pending|open)\b/.test(lower) &&
      /\b(decisions?|tasks?|sign.?offs?|approvals?)\b/.test(lower))
  ) {
    const { data: tasks } = await sb
      .from("mc_tasks")
      .select("id, title, status, task_type, priority")
      .eq("assigned_to", "david")
      .in("status", ["todo", "in_progress"])
      .order("priority", { ascending: true })
      .limit(10);

    const { data: boards } = await sb
      .from("mc_challenge_board")
      .select("id, decision_title, status")
      .in("status", ["open", "deliberating"])
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: notifications } = await sb
      .from("mc_ed_notifications")
      .select("id, title, category, priority")
      .in("status", ["pending", "delivered"])
      .order("created_at", { ascending: false })
      .limit(5);

    const parts: string[] = [];

    if (tasks?.length) {
      parts.push(
        `**${tasks.length} pending decision${tasks.length > 1 ? "s" : ""}:**`,
      );
      for (const t of tasks) {
        parts.push(
          `- [${t.task_type || "decision"}] ${t.title} (priority: ${t.priority})`,
        );
      }
    }
    if (boards?.length) {
      parts.push(
        `\n**${boards.length} open challenge board${boards.length > 1 ? "s" : ""}:**`,
      );
      for (const b of boards) {
        parts.push(`- [${b.status}] ${b.decision_title}`);
      }
    }
    if (notifications?.length) {
      parts.push(
        `\n**${notifications.length} notification${notifications.length > 1 ? "s" : ""} waiting:**`,
      );
      for (const n of notifications) {
        parts.push(`- [${n.priority}] ${n.title} (${n.category})`);
      }
    }

    if (!parts.length) return "Nothing waiting for you right now. All clear.";
    return parts.join("\n");
  }

  // "project status" / "show projects" / "portfolio"
  if (
    (/\b(projects?|portfolio)\b/.test(lower) &&
      /\b(status|list|show|how|what)\b/.test(lower)) ||
    (/\b(status|list|show|how|what)\b/.test(lower) &&
      /\b(projects?|portfolio)\b/.test(lower))
  ) {
    const { data: projects } = await sb
      .from("mc_projects")
      .select("id, name, status, revenue_target_monthly, description")
      .eq("status", "active")
      .order("revenue_target_monthly", { ascending: false });

    if (!projects?.length) return "No active projects right now.";

    const totalTarget = projects.reduce(
      (s, p) => s + (p.revenue_target_monthly || 0),
      0,
    );
    let response = `**${projects.length} active project${projects.length > 1 ? "s" : ""} (£${totalTarget.toLocaleString()}/mo target):**\n`;
    for (const p of projects) {
      response += `- **${p.name}** — £${p.revenue_target_monthly || 0}/mo${p.description ? ` — ${p.description.slice(0, 80)}` : ""}\n`;
    }
    return response;
  }

  // "agent status" / "who's active" / "team status"
  if (
    (/\b(agents?|team)\b/.test(lower) &&
      /\b(status|list|show|who|active)\b/.test(lower)) ||
    (/\b(status|list|show|who|active)\b/.test(lower) &&
      /\b(agents?|team)\b/.test(lower))
  ) {
    const { data: agents } = await sb
      .from("mc_agents")
      .select("name, status, department, role")
      .order("name");

    if (!agents?.length) return "No agents configured.";

    const active = agents.filter((a) => a.status === "active");
    let response = `**${active.length}/${agents.length} agents active:**\n`;
    for (const a of active) {
      response += `- **${a.name}** — ${a.role || a.department || "unassigned"}\n`;
    }
    return response;
  }

  // "challenge board status" / "open decisions"
  if (
    /\b(challenge|board)\b/.test(lower) &&
    /\b(status|open|pending|what|show|list)\b/.test(lower)
  ) {
    const { data: boards } = await sb
      .from("mc_challenge_board")
      .select("id, decision_title, status, options, created_at")
      .in("status", ["open", "deliberating"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (!boards?.length) return "No open challenge boards right now.";

    let response = `**${boards.length} open board${boards.length > 1 ? "s" : ""}:**\n`;
    for (const b of boards) {
      const opts = b.options as { label: string; summary: string }[];
      response += `- [${b.status}] **${b.decision_title}** — ${opts.length} options\n`;
    }
    return response;
  }

  // "sitrep" / "what's happening" / "overview"
  if (
    /\b(sitrep|sit.?rep|situation|overview|what'?s happening|what'?s going on)\b/i.test(
      lower,
    )
  ) {
    const [jobs, tasks, boards, notifications] = await Promise.all([
      sb
        .from("mc_jobs")
        .select("id, status")
        .in("status", ["queued", "running"]),
      sb
        .from("mc_tasks")
        .select("id")
        .eq("assigned_to", "david")
        .in("status", ["todo", "in_progress"]),
      sb
        .from("mc_challenge_board")
        .select("id")
        .in("status", ["open", "deliberating"]),
      sb
        .from("mc_ed_notifications")
        .select("id")
        .in("status", ["pending", "delivered"]),
    ]);

    const jobCount = jobs.data?.length || 0;
    const taskCount = tasks.data?.length || 0;
    const boardCount = boards.data?.length || 0;
    const notifCount = notifications.data?.length || 0;

    const parts: string[] = ["**Sitrep:**"];
    parts.push(`- **Jobs:** ${jobCount} active`);
    parts.push(`- **Your decisions:** ${taskCount} pending`);
    parts.push(`- **Challenge boards:** ${boardCount} open`);
    parts.push(`- **Notifications:** ${notifCount} waiting`);

    if (taskCount === 0 && boardCount === 0 && notifCount === 0) {
      parts.push("\nAll clear — nothing needs your attention right now.");
    }

    return parts.join("\n");
  }

  // "deployment status" / "vercel status"
  if (
    /\b(deploy|deployment|vercel)\b/.test(lower) &&
    /\b(status|latest|last|recent)\b/.test(lower)
  ) {
    const { data: deploys } = await sb
      .from("mc_jobs")
      .select("id, title, status, completed_at")
      .ilike("title", "%deploy%")
      .order("created_at", { ascending: false })
      .limit(3);

    if (!deploys?.length) return "No recent deployments found.";

    let response = "**Recent deployments:**\n";
    for (const d of deploys) {
      const when = d.completed_at
        ? new Date(d.completed_at).toLocaleString("en-GB")
        : "in progress";
      response += `- **${d.title}** — ${d.status} (${when})\n`;
    }
    return response;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const sb = supabaseAdmin();

  let body: EdChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    conversation_id,
    message,
    images,
    target: rawTarget,
    page_context,
  } = body;
  if (!conversation_id || !message?.trim()) {
    return Response.json(
      { error: "conversation_id and message are required" },
      { status: 400 },
    );
  }

  // Detect target: explicit target param, @mention, or default to ed
  // Default to Jarvis; use @ed to route to Ed
  const target: ChatTarget =
    rawTarget === "ed" ? "ed" : /@ed\b/i.test(message) ? "ed" : "jarvis";

  // Ensure conversation exists (auto-create if deleted or missing)
  const { data: convExists } = await sb
    .from("mc_ed_conversations")
    .select("id")
    .eq("id", conversation_id)
    .single();

  if (!convExists) {
    await sb.from("mc_ed_conversations").insert({
      id: conversation_id,
      title: message.slice(0, 50) || "New conversation",
      is_active: true,
    });
  }

  // Store user message with sender metadata
  const { error: insertErr } = await sb
    .from("mc_ed_messages")
    .insert({
      conversation_id,
      role: "user",
      content: message,
      metadata: {
        sender: "david",
        target,
        ...(images?.length
          ? { has_images: true, image_count: images.length }
          : {}),
      },
    })
    .select("id")
    .single();

  if (insertErr) {
    return Response.json({ error: insertErr.message }, { status: 500 });
  }

  // Route message to appropriate tier
  const tier = routeMessage(message, !!images?.length);

  // Try quick-path first (only if router says so and no images, and target is Ed)
  if (tier === "quick-path" && !images?.length && target === "ed") {
    const quickAnswer = await tryQuickPath(message);
    if (quickAnswer) {
      const { data: assistantMsg } = await sb
        .from("mc_ed_messages")
        .insert({
          conversation_id,
          role: "assistant",
          content: quickAnswer,
          model_used: "quick-path",
          duration_ms: Date.now() - startTime,
        })
        .select("id")
        .single();

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              sseEncode({ type: "text", content: quickAnswer }),
            ),
          );
          controller.enqueue(
            new TextEncoder().encode(
              sseEncode({
                type: "done",
                message_id: assistantMsg?.id || "",
                duration_ms: Date.now() - startTime,
                model_used: "quick-path",
              }),
            ),
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // --- JARVIS PATH: Route to OpenClaw agent ---
  if (target === "jarvis") {
    const sessionKey = `jarvis-${conversation_id.slice(0, 8)}`;

    // Busy detection: if Jarvis is already processing for this conversation, queue as job
    const existing = activeSessions.get(sessionKey);
    if (existing) {
      const { data: job } = await sb
        .from("mc_jobs")
        .insert({
          title: `Queued chat: ${message.slice(0, 80)}`,
          prompt_text: message,
          engine: "claude",
          status: "queued",
          priority: 2,
          source: "chat-overflow",
        })
        .select("id")
        .single();

      const elapsed = Math.round((Date.now() - existing.startedAt) / 1000);
      const busyResponse = `Jarvis is working on your previous request (${elapsed}s ago). Queued this as a job${job ? ` (${job.id.slice(0, 8)})` : ""} — you'll get a notification when it's done.`;

      await sb.from("mc_ed_messages").insert({
        conversation_id,
        role: "assistant",
        content: busyResponse,
        metadata: { sender: "jarvis", queued_job_id: job?.id },
        model_used: "busy-queue",
        duration_ms: Date.now() - startTime,
      });

      const busyStream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(
            enc.encode(sseEncode({ type: "text", content: busyResponse })),
          );
          controller.enqueue(
            enc.encode(
              sseEncode({
                type: "done",
                message_id: "",
                duration_ms: Date.now() - startTime,
                model_used: "busy-queue",
              }),
            ),
          );
          controller.close();
        },
      });
      return new Response(busyStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Mark session as busy
    activeSessions.set(sessionKey, { startedAt: Date.now(), message });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const [jarvisCtx, pageCtx] = await Promise.all([
            buildJarvisContext(),
            buildPageContext(page_context),
          ]);
          const context = pageCtx + jarvisCtx;
          let fullText = "";
          let lastChunkAt = Date.now();
          let sentStillWorking = false;
          let timedOut = false;

          const STALL_TIMEOUT = 30_000; // 30s no text = "still working"
          const HARD_TIMEOUT = 90_000; // 90s = graceful close (buffer before Cloudflare 100s)

          const stallChecker = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTime;
            const sinceLastChunk = now - lastChunkAt;

            if (elapsed >= HARD_TIMEOUT && fullText.length > 0) {
              timedOut = true;
              clearInterval(stallChecker);
              return;
            }

            if (sinceLastChunk >= STALL_TIMEOUT && !sentStillWorking) {
              sentStillWorking = true;
              controller.enqueue(
                encoder.encode(
                  sseEncode({
                    type: "text",
                    content: "\n\n*Still working on this...*",
                  }),
                ),
              );
            }
          }, 5_000);

          try {
            for await (const chunk of openclawStream({
              message,
              context,
              sessionId: sessionKey,
            })) {
              lastChunkAt = Date.now();
              fullText += chunk;
              controller.enqueue(
                encoder.encode(sseEncode({ type: "text", content: chunk })),
              );
              if (timedOut) break;
            }
          } finally {
            clearInterval(stallChecker);
          }

          // If timed out, create a continuation job
          if (timedOut) {
            const timeoutNote =
              "\n\n---\n*Taking longer than expected. Jarvis is continuing in the background — you'll get a notification when done.*";
            controller.enqueue(
              encoder.encode(sseEncode({ type: "text", content: timeoutNote })),
            );
            fullText += timeoutNote;

            const { data: bgJob } = await sb
              .from("mc_jobs")
              .insert({
                title: `Jarvis continuation: ${message.slice(0, 60)}`,
                prompt_text: `Continue this work that timed out.\n\nOriginal request: ${message}\n\nPartial response:\n${fullText.slice(0, 2000)}`,
                engine: "claude",
                status: "queued",
                priority: 1,
                source: "timeout-continuation",
              })
              .select("id")
              .single();

            if (bgJob) {
              controller.enqueue(
                encoder.encode(
                  sseEncode({
                    type: "action",
                    action: { type: "create_job", job_id: bgJob.id, ok: true },
                  }),
                ),
              );
            }
          }

          // Parse actions from Jarvis response (same pipeline as Ed)
          const { cleanText, actions } = parseActions(fullText);

          if (actions.length > 0 && cleanText !== fullText) {
            controller.enqueue(
              encoder.encode(
                sseEncode({
                  type: "text",
                  content: `\n<!-- REPLACE -->\n${cleanText}`,
                }),
              ),
            );
          }

          let actionResults: {
            type: string;
            ok: boolean;
            id?: string;
            job_id?: string;
            task_id?: string;
            error?: string;
          }[] = [];
          if (actions.length > 0) {
            actionResults = await executeActions(actions);
            for (const result of actionResults) {
              controller.enqueue(
                encoder.encode(sseEncode({ type: "action", action: result })),
              );
            }
          }

          const durationMs = Date.now() - startTime;

          // Store Jarvis response (clean text + actions)
          const { data: assistantMsg } = await sb
            .from("mc_ed_messages")
            .insert({
              conversation_id,
              role: "assistant",
              content: cleanText,
              actions_taken:
                actionResults.length > 0 ? actionResults : undefined,
              metadata: { sender: "jarvis" },
              model_used: timedOut ? "openclaw-timeout" : "openclaw",
              duration_ms: durationMs,
            })
            .select("id")
            .single();

          controller.enqueue(
            encoder.encode(
              sseEncode({
                type: "done",
                message_id: assistantMsg?.id || "",
                duration_ms: durationMs,
                model_used: timedOut ? "openclaw-timeout" : "openclaw",
              }),
            ),
          );

          // Record token usage for Jarvis (text-length estimate)
          trackChatUsage(
            "Jarvis",
            "estimate",
            assistantMsg?.id,
            null,
            fullText,
            "openclaw",
          ).catch(() => {});
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(sseEncode({ type: "error", error: errorMessage })),
          );
        } finally {
          activeSessions.delete(sessionKey);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // --- ED PATH: LLM streaming via OpenClaw ---
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Build Ed's full context (system prompt + MC state + history)
        const edContext = await buildEdOpenClawContext(
          conversation_id,
          page_context,
        );

        // Build the user message (images described as text)
        let userContent = message;
        if (images?.length) {
          userContent = `[${images.length} image(s) attached — image analysis not available]\n\n${message}`;
        }

        let fullText = "";
        for await (const chunk of openclawStream({
          message: userContent,
          context: edContext,
          sessionId: `ed-${conversation_id.slice(0, 8)}`,
        })) {
          fullText += chunk;
          controller.enqueue(
            encoder.encode(sseEncode({ type: "text", content: chunk })),
          );
        }

        // Parse actions from the complete response
        const { cleanText, actions } = parseActions(fullText);

        // If actions were stripped, send the clean version
        if (actions.length > 0 && cleanText !== fullText) {
          controller.enqueue(
            encoder.encode(
              sseEncode({
                type: "text",
                content: `\n<!-- REPLACE -->\n${cleanText}`,
              }),
            ),
          );
        }

        // Execute actions
        let actionResults: {
          type: string;
          ok: boolean;
          id?: string;
          job_id?: string;
          task_id?: string;
          error?: string;
        }[] = [];
        if (actions.length > 0) {
          actionResults = await executeActions(actions);
          for (const result of actionResults) {
            controller.enqueue(
              encoder.encode(sseEncode({ type: "action", action: result })),
            );
          }
        }

        const durationMs = Date.now() - startTime;

        // Store Ed's response
        const { data: assistantMsg } = await sb
          .from("mc_ed_messages")
          .insert({
            conversation_id,
            role: "assistant",
            content: cleanText,
            actions_taken: actionResults,
            metadata: { sender: "ed" },
            model_used: "openclaw",
            duration_ms: durationMs,
          })
          .select("id")
          .single();

        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: "done",
              message_id: assistantMsg?.id || "",
              duration_ms: durationMs,
              model_used: "openclaw",
            }),
          ),
        );

        // Record token usage for Ed (text-length estimate)
        trackChatUsage(
          "Ed",
          "estimate",
          assistantMsg?.id,
          null,
          fullText,
          "openclaw",
        ).catch(() => {});
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(sseEncode({ type: "error", error: errorMessage })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/** Fire-and-forget: look up agent by name, record usage, check budget */
async function trackChatUsage(
  agentName: string,
  sourceType: "chat" | "estimate",
  messageId: string | undefined,
  _cliUsage: unknown,
  fullText: string,
  engine: string,
  model?: string,
): Promise<void> {
  const sb = supabaseAdmin();
  const { data: agent } = await sb
    .from("mc_agents")
    .select("id")
    .eq("name", agentName)
    .single();
  if (!agent) return;

  const tokensIn = estimateTokens(fullText);
  const tokensOut = estimateTokens(fullText);

  // Also populate mc_ed_messages.tokens_used
  if (messageId) {
    await sb
      .from("mc_ed_messages")
      .update({ tokens_used: tokensIn + tokensOut })
      .eq("id", messageId);
  }

  await recordUsage({
    agentId: agent.id,
    sourceType,
    sourceId: messageId,
    tokensIn,
    tokensOut,
    engine,
    model,
  });

  await checkTokenBudget(agent.id);
}
