/**
 * Ed Chat SSE endpoint.
 *
 * POST /api/ed/chat
 * Body: { conversation_id, message, images? }
 * Response: SSE stream with text chunks, action results, and done event.
 *
 * Quick-path: Supabase-answerable questions (status checks) bypass Claude CLI entirely.
 */

export const runtime = 'nodejs';
export const maxDuration = 180;

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { buildSystemPrompt } from '@/lib/ed/system-prompt';
import { buildContextBlock, loadConversationHistory } from '@/lib/ed/context';
import { claudeCall } from '@/lib/ed/claude-stream';
import { parseActions, executeActions } from '@/lib/ed/actions';
import type { EdChatRequest, EdStreamChunk } from '@/lib/ed/types';

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
  const { data: userMsg, error: insertErr } = await sb
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

  // Try quick-path first
  const quickAnswer = await tryQuickPath(message);
  if (quickAnswer && !images?.length) {
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
            sseEncode({ type: 'done', message_id: assistantMsg?.id || '', duration_ms: Date.now() - startTime }),
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

  // Full Claude CLI path
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Build context
        const [contextBlock, historyText] = await Promise.all([
          buildContextBlock(),
          loadConversationHistory(conversation_id),
        ]);

        const systemPrompt = buildSystemPrompt(contextBlock);

        let userPrompt = '';
        if (historyText) userPrompt += historyText + '\n';
        userPrompt += `David: ${message}`;

        if (images?.length) {
          userPrompt += `\n\n[David shared ${images.length} image${images.length > 1 ? 's' : ''}]`;
        }

        userPrompt += '\n\nRespond as Ed:';

        // Call Claude CLI (non-streaming for reliability)
        const rawResponse = await claudeCall(systemPrompt, userPrompt);

        // Parse actions
        const { cleanText, actions } = parseActions(rawResponse);

        // Stream text to client
        controller.enqueue(encoder.encode(sseEncode({ type: 'text', content: cleanText })));

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
            model_used: 'claude-cli',
            duration_ms: durationMs,
          })
          .select('id')
          .single();

        controller.enqueue(
          encoder.encode(
            sseEncode({ type: 'done', message_id: assistantMsg?.id || '', duration_ms: durationMs }),
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
