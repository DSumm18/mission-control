import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

const CreateBody = z.object({
  title: z.string().min(1),
  engine: z.enum(['claude', 'gemini', 'openai', 'shell']),
  repo_path: z.string().min(1),
  prompt_text: z.string().min(1),
  output_dir: z.string().min(1),
  agent_id: z.string().uuid().nullable().optional(),
  parent_job_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  job_type: z.enum(['task', 'decomposition', 'review', 'integration', 'pm']).optional(),
  source: z.enum(['dashboard', 'telegram', 'cron', 'orchestrator', 'api']).optional(),
});

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('mc_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateBody.parse(await req.json());
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('mc_jobs')
      .insert({
        title: body.title,
        engine: body.engine,
        repo_path: body.repo_path,
        prompt_text: body.prompt_text,
        output_dir: body.output_dir,
        status: 'queued',
        ...(body.agent_id && { agent_id: body.agent_id }),
        ...(body.parent_job_id && { parent_job_id: body.parent_job_id }),
        ...(body.project_id && { project_id: body.project_id }),
        ...(body.priority && { priority: body.priority }),
        ...(body.job_type && { job_type: body.job_type }),
        ...(body.source && { source: body.source }),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ job: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 });
  }
}
