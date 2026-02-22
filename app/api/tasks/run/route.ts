import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { requireRoleFromBearer } from '@/lib/auth/require-role';
import { getLLMAdapter } from '@/lib/llm';
import { runQAGates } from '@/lib/qa/checks';

function authorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  const headerMatch = auth === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret;
  const queryMatch = req.nextUrl.searchParams.get('token') === secret;
  return headerMatch || queryMatch;
}

async function runOneTask(systemUserId?: string) {
  const sb = supabaseAdmin();
  const { data: task } = await sb.from('tasks').select('*').eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!task) return { ok: true, message: 'no queued tasks' };

  await sb.from('tasks').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', task.id);

  try {
    const adapter = getLLMAdapter();
    const output = await adapter.completeStructured({
      prompt: task.description || `Complete task: ${task.title}`,
      schemaName: 'LLMTaskOutput'
    });

    const qa = runQAGates(output);

    const { data: llmRun } = await sb.from('llm_runs').insert({
      task_id: task.id,
      provider: 'openai',
      model: process.env.MC_LLM_ROUTER_MODEL || 'gpt-4.1-mini',
      status: qa.passed ? 'passed' : 'needs_decision',
      output_json: output,
      qa_flags: qa.flags,
      created_by: systemUserId || task.created_by || null
    }).select('id').single();

    if (!qa.passed) {
      await sb.from('decisions').insert({
        task_id: task.id,
        llm_run_id: llmRun?.id,
        type: 'qa_exception',
        status: 'pending',
        requested_by: systemUserId || task.created_by || null,
        title: 'QA gate requires approval',
        payload: { qaFlags: qa.flags }
      });
      await sb.from('tasks').update({ status: 'blocked' }).eq('id', task.id);
    } else {
      await sb.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id);
    }

    await sb.from('activity_logs').insert({
      actor_user_id: systemUserId || task.created_by || null,
      entity_type: 'task',
      entity_id: task.id,
      action: qa.passed ? 'run_completed' : 'run_blocked_for_decision',
      payload: {}
    });

    return { ok: true, taskId: task.id };
  } catch (e: any) {
    await sb.from('decisions').insert({
      task_id: task.id,
      type: 'llm_invalid_output',
      status: 'pending',
      requested_by: systemUserId || task.created_by || null,
      title: 'LLM output invalid after repair retry',
      payload: { error: e?.message || 'unknown' }
    });

    await sb.from('tasks').update({ status: 'blocked' }).eq('id', task.id);
    await sb.from('activity_logs').insert({
      actor_user_id: systemUserId || task.created_by || null,
      entity_type: 'task',
      entity_id: task.id,
      action: 'run_failed_decision_created',
      payload: { error: e?.message || 'unknown' }
    });

    return { ok: false, taskId: task.id, decisionCreated: true };
  }
}

export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized cron' }, { status: 401 });
  }
  const result = await runOneTask();
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoleFromBearer(req.headers.get('authorization'), ['owner', 'admin', 'system']);
    const result = await runOneTask(auth.userId);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 403 });
  }
}
