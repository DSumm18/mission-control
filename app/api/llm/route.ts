import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLLMAdapter } from '@/lib/llm';
import { runQAGates } from '@/lib/qa/checks';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { requireRoleFromBearer } from '@/lib/auth/require-role';

const Req = z.object({ taskId: z.string().uuid(), prompt: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoleFromBearer(req.headers.get('authorization'), ['owner','admin','editor','system']);
    const body = Req.parse(await req.json());
    const sb = supabaseAdmin();
    const adapter = getLLMAdapter();

    try {
      const output = await adapter.completeStructured({ prompt: body.prompt, schemaName: 'LLMTaskOutput' });
      const qa = runQAGates(output);

      const { data: llmRun } = await sb.from('llm_runs').insert({
        task_id: body.taskId,
        provider: 'openai',
        model: 'gpt-4.1-mini',
        status: qa.passed ? 'passed' : 'needs_decision',
        output_json: output,
        qa_flags: qa.flags,
        created_by: auth.userId
      }).select('id').single();

      if (!qa.passed) {
        await sb.from('decisions').insert({
          task_id: body.taskId,
          llm_run_id: llmRun?.id,
          type: 'qa_exception',
          status: 'pending',
          requested_by: auth.userId,
          title: 'QA gate requires approval',
          payload: { qaFlags: qa.flags }
        });
      }

      return NextResponse.json({ ok: true, qaPassed: qa.passed, qaFlags: qa.flags });
    } catch (e:any) {
      await sb.from('decisions').insert({
        task_id: body.taskId,
        type: 'llm_invalid_output',
        status: 'pending',
        requested_by: auth.userId,
        title: 'LLM output invalid after repair retry',
        payload: { error: e?.message || 'unknown' }
      });
      return NextResponse.json({ ok: false, decisionCreated: true }, { status: 422 });
    }
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 403 });
  }
}
