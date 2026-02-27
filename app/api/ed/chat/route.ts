/**
 * Ed Chat SSE endpoint.
 *
 * POST /api/ed/chat
 * Body: { conversation_id, message, images? }
 * Response: SSE stream with text chunks, action results, and done event.
 *
 * Quick-path: Supabase-answerable questions (status checks) bypass LLM entirely.
 * Model routing: Haiku for fast replies, Sonnet for complex analysis.
 */

export const runtime = 'nodejs';
export const maxDuration = 180;

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { buildSystemPrompt } from '@/lib/ed/system-prompt';
import { buildContextBlock, loadConversationHistory } from '@/lib/ed/context';
import { claudeStream } from '@/lib/ed/claude-stream';
import { parseActions, executeActions } from '@/lib/ed/actions';
import { routeMessage, getModelId, getModelDisplayName } from '@/lib/ed/model-router';
import type { EdChatRequest, EdStreamChunk } from '@/lib/ed/types';
import type Anthropic from '@anthropic-ai/sdk';

function sseEncode(chunk: EdStreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/** Quick-path: answer simple status questions from Supabase directly */
async function tryQuickPath(message: string): Promise<string | null> {
  const lower = message.toLowerCase();
  const sb = supabaseAdmin();

  // "what jobs are running" / "job status" / "active jobs"
  if (/\b(jobs?|running|queued|active)\b/.test(lower) && /\b(status|what|how|any|running|list)\b/.test(lower)) {
    const { data: jobs } = await sb
      .from('mc_jobs')
      .select('id, title, status, engine, created_at')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (!jobs?.length) return 'All clear — no jobs running or queued right now.';

    let response = `**${jobs.length} active job${jobs.length > 1 ? 's' : ''}:**\n`;
    for (const j of jobs) {
      response += `- **${j.title}** [${j.status}] (${j.engine})\n`;
    }
    return response;
  }

  // "newsletter status" / "what's the latest newsletter"
  if (/\bnewsletter/.test(lower) && /\b(status|latest|current|progress|where)\b/.test(lower)) {
    const { data: newsletters } = await sb
      .from('mc_newsletters')
      .select('id, week_no, title, pipeline_status')
      .order('week_no', { ascending: false })
      .limit(3);

    if (!newsletters?.length) return 'No newsletters found in the system yet.';

    let response = '**Recent newsletters:**\n';
    for (const n of newsletters) {
      response += `- Week ${n.week_no}: "${n.title}" — **${n.pipeline_status}**\n`;
    }
    return response;
  }

  // "research status" / "pending research"
  if (/\bresearch/.test(lower) && /\b(status|pending|what|list)\b/.test(lower)) {
    const { data: research } = await sb
      .from('mc_research_items')
      .select('id, title, status, relevance_score, content_type')
      .in('status', ['captured', 'assessing', 'assessed'])
      .order('created_at', { ascending: false })
      .limit(8);

    if (!research?.length) return 'Research pipeline is empty — nothing pending.';

    let response = `**${research.length} research item${research.length > 1 ? 's' : ''} in pipeline:**\n`;
    for (const r of research) {
      response += `- [${r.status}] ${r.title || '(untitled)'} (${r.content_type}, score: ${r.relevance_score || '?'}/10)\n`;
    }
    return response;
  }

  // "my tasks" / "what do I need to do" / "pending decisions"
  if (
    /what (do i|should i) need to (do|decide|approve)/i.test(lower) ||
    /what('s| is) (pending|waiting|open)/i.test(lower) ||
    (/\b(my|david'?s?)\b/.test(lower) && /\b(tasks?|decisions?|sign.?offs?)\b/.test(lower)) ||
    (/\b(pending|open)\b/.test(lower) && /\b(decisions?|tasks?|sign.?offs?|approvals?)\b/.test(lower))
  ) {
    const { data: tasks } = await sb
      .from('mc_tasks')
      .select('id, title, status, task_type, priority')
      .eq('assigned_to', 'david')
      .in('status', ['todo', 'in_progress'])
      .order('priority', { ascending: true })
      .limit(10);

    const { data: boards } = await sb
      .from('mc_challenge_board')
      .select('id, decision_title, status')
      .in('status', ['open', 'deliberating'])
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: notifications } = await sb
      .from('mc_ed_notifications')
      .select('id, title, category, priority')
      .in('status', ['pending', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(5);

    const parts: string[] = [];

    if (tasks?.length) {
      parts.push(`**${tasks.length} pending decision${tasks.length > 1 ? 's' : ''}:**`);
      for (const t of tasks) {
        parts.push(`- [${t.task_type || 'decision'}] ${t.title} (priority: ${t.priority})`);
      }
    }
    if (boards?.length) {
      parts.push(`\n**${boards.length} open challenge board${boards.length > 1 ? 's' : ''}:**`);
      for (const b of boards) {
        parts.push(`- [${b.status}] ${b.decision_title}`);
      }
    }
    if (notifications?.length) {
      parts.push(`\n**${notifications.length} notification${notifications.length > 1 ? 's' : ''} waiting:**`);
      for (const n of notifications) {
        parts.push(`- [${n.priority}] ${n.title} (${n.category})`);
      }
    }

    if (!parts.length) return 'Nothing waiting for you right now. All clear.';
    return parts.join('\n');
  }

  // "project status" / "show projects" / "portfolio"
  if (
    (/\b(projects?|portfolio)\b/.test(lower) && /\b(status|list|show|how|what)\b/.test(lower)) ||
    (/\b(status|list|show|how|what)\b/.test(lower) && /\b(projects?|portfolio)\b/.test(lower))
  ) {
    const { data: projects } = await sb
      .from('mc_projects')
      .select('id, name, status, revenue_target_monthly, description')
      .eq('status', 'active')
      .order('revenue_target_monthly', { ascending: false });

    if (!projects?.length) return 'No active projects right now.';

    const totalTarget = projects.reduce((s, p) => s + (p.revenue_target_monthly || 0), 0);
    let response = `**${projects.length} active project${projects.length > 1 ? 's' : ''} (£${totalTarget.toLocaleString()}/mo target):**\n`;
    for (const p of projects) {
      response += `- **${p.name}** — £${p.revenue_target_monthly || 0}/mo${p.description ? ` — ${p.description.slice(0, 80)}` : ''}\n`;
    }
    return response;
  }

  // "agent status" / "who's active" / "team status"
  if (
    (/\b(agents?|team)\b/.test(lower) && /\b(status|list|show|who|active)\b/.test(lower)) ||
    (/\b(status|list|show|who|active)\b/.test(lower) && /\b(agents?|team)\b/.test(lower))
  ) {
    const { data: agents } = await sb
      .from('mc_agents')
      .select('name, status, department, role')
      .order('name');

    if (!agents?.length) return 'No agents configured.';

    const active = agents.filter(a => a.status === 'active');
    let response = `**${active.length}/${agents.length} agents active:**\n`;
    for (const a of active) {
      response += `- **${a.name}** — ${a.role || a.department || 'unassigned'}\n`;
    }
    return response;
  }

  // "challenge board status" / "open decisions"
  if (/\b(challenge|board)\b/.test(lower) && /\b(status|open|pending|what|show|list)\b/.test(lower)) {
    const { data: boards } = await sb
      .from('mc_challenge_board')
      .select('id, decision_title, status, options, created_at')
      .in('status', ['open', 'deliberating'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (!boards?.length) return 'No open challenge boards right now.';

    let response = `**${boards.length} open board${boards.length > 1 ? 's' : ''}:**\n`;
    for (const b of boards) {
      const opts = b.options as { label: string; summary: string }[];
      response += `- [${b.status}] **${b.decision_title}** — ${opts.length} options\n`;
    }
    return response;
  }

  // "sitrep" / "what's happening" / "overview"
  if (/\b(sitrep|sit.?rep|situation|overview|what'?s happening|what'?s going on)\b/i.test(lower)) {
    const [jobs, tasks, boards, notifications] = await Promise.all([
      sb.from('mc_jobs').select('id, status').in('status', ['queued', 'running']),
      sb.from('mc_tasks').select('id').eq('assigned_to', 'david').in('status', ['todo', 'in_progress']),
      sb.from('mc_challenge_board').select('id').in('status', ['open', 'deliberating']),
      sb.from('mc_ed_notifications').select('id').in('status', ['pending', 'delivered']),
    ]);

    const jobCount = jobs.data?.length || 0;
    const taskCount = tasks.data?.length || 0;
    const boardCount = boards.data?.length || 0;
    const notifCount = notifications.data?.length || 0;

    const parts: string[] = ['**Sitrep:**'];
    parts.push(`- **Jobs:** ${jobCount} active`);
    parts.push(`- **Your decisions:** ${taskCount} pending`);
    parts.push(`- **Challenge boards:** ${boardCount} open`);
    parts.push(`- **Notifications:** ${notifCount} waiting`);

    if (taskCount === 0 && boardCount === 0 && notifCount === 0) {
      parts.push('\nAll clear — nothing needs your attention right now.');
    }

    return parts.join('\n');
  }

  // "deployment status" / "vercel status"
  if (/\b(deploy|deployment|vercel)\b/.test(lower) && /\b(status|latest|last|recent)\b/.test(lower)) {
    const { data: deploys } = await sb
      .from('mc_jobs')
      .select('id, title, status, completed_at')
      .ilike('title', '%deploy%')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!deploys?.length) return 'No recent deployments found.';

    let response = '**Recent deployments:**\n';
    for (const d of deploys) {
      const when = d.completed_at ? new Date(d.completed_at).toLocaleString('en-GB') : 'in progress';
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
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { conversation_id, message, images } = body;
  if (!conversation_id || !message?.trim()) {
    return Response.json({ error: 'conversation_id and message are required' }, { status: 400 });
  }

  // Store user message
  const { error: insertErr } = await sb
    .from('mc_ed_messages')
    .insert({
      conversation_id,
      role: 'user',
      content: message,
      metadata: images?.length ? { has_images: true, image_count: images.length } : {},
    })
    .select('id')
    .single();

  if (insertErr) {
    return Response.json({ error: insertErr.message }, { status: 500 });
  }

  // Route message to appropriate tier
  const tier = routeMessage(message, !!images?.length);

  // Try quick-path first (only if router says so and no images)
  if (tier === 'quick-path' && !images?.length) {
    const quickAnswer = await tryQuickPath(message);
    if (quickAnswer) {
      const { data: assistantMsg } = await sb
        .from('mc_ed_messages')
        .insert({
          conversation_id,
          role: 'assistant',
          content: quickAnswer,
          model_used: 'quick-path',
          duration_ms: Date.now() - startTime,
        })
        .select('id')
        .single();

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseEncode({ type: 'text', content: quickAnswer })));
          controller.enqueue(
            new TextEncoder().encode(
              sseEncode({ type: 'done', message_id: assistantMsg?.id || '', duration_ms: Date.now() - startTime, model_used: 'quick-path' }),
            ),
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }
  }

  // LLM streaming path (Haiku or Sonnet)
  const modelId = getModelId(tier === 'quick-path' ? 'haiku' : tier);
  const modelDisplay = getModelDisplayName(tier === 'quick-path' ? 'haiku' : tier);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Build context and load history in parallel
        const [contextBlock, historyMessages] = await Promise.all([
          buildContextBlock(),
          loadConversationHistory(conversation_id),
        ]);

        const systemPrompt = buildSystemPrompt(contextBlock);

        // Build messages array: history + current message
        const messages: Anthropic.MessageCreateParams['messages'] = [...historyMessages];

        // Build current user message content
        const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

        if (images?.length) {
          for (const img of images) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: img.base64,
              },
            });
          }
        }

        content.push({ type: 'text', text: message });
        messages.push({ role: 'user', content });

        // Ensure alternating roles (Anthropic requirement)
        const cleanMessages = ensureAlternatingRoles(messages);

        // Stream from OpenRouter
        let fullText = '';
        for await (const chunk of claudeStream({
          systemPrompt,
          messages: cleanMessages,
          model: modelId,
        })) {
          fullText += chunk;
          controller.enqueue(encoder.encode(sseEncode({ type: 'text', content: chunk })));
        }

        // Parse actions from the complete response
        const { cleanText, actions } = parseActions(fullText);

        // If actions were stripped, send the clean version
        if (actions.length > 0 && cleanText !== fullText) {
          controller.enqueue(encoder.encode(sseEncode({ type: 'text', content: `\n<!-- REPLACE -->\n${cleanText}` })));
        }

        // Execute actions
        let actionResults: { type: string; ok: boolean; id?: string; job_id?: string; task_id?: string; error?: string }[] = [];
        if (actions.length > 0) {
          actionResults = await executeActions(actions);
          for (const result of actionResults) {
            controller.enqueue(encoder.encode(sseEncode({ type: 'action', action: result })));
          }
        }

        const durationMs = Date.now() - startTime;

        // Store Ed's response
        const { data: assistantMsg } = await sb
          .from('mc_ed_messages')
          .insert({
            conversation_id,
            role: 'assistant',
            content: cleanText,
            actions_taken: actionResults,
            model_used: modelDisplay,
            duration_ms: durationMs,
          })
          .select('id')
          .single();

        controller.enqueue(
          encoder.encode(
            sseEncode({ type: 'done', message_id: assistantMsg?.id || '', duration_ms: durationMs, model_used: modelDisplay }),
          ),
        );
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(sseEncode({ type: 'error', error: errorMessage })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/** Ensure messages alternate user/assistant (merge consecutive same-role) */
function ensureAlternatingRoles(
  messages: Anthropic.MessageCreateParams['messages'],
): Anthropic.MessageCreateParams['messages'] {
  if (messages.length === 0) return messages;

  const result: Anthropic.MessageCreateParams['messages'] = [messages[0]];
  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1];
    const curr = messages[i];
    if (prev.role === curr.role) {
      // Merge content
      const prevText = typeof prev.content === 'string' ? prev.content : prev.content.map(b => 'text' in b ? b.text : '').join('\n');
      const currText = typeof curr.content === 'string' ? curr.content : curr.content.map(b => 'text' in b ? b.text : '').join('\n');
      prev.content = `${prevText}\n${currText}`;
    } else {
      result.push(curr);
    }
  }

  // Must start with user
  if (result[0].role !== 'user') {
    result.shift();
  }

  return result;
}
