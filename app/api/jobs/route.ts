import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

const CreateBody = z.object({
  title: z.string().min(1),
  engine: z.enum(['claude', 'gemini', 'openai', 'shell']),
  repo_path: z.string().min(1),
  prompt_text: z.string().min(1),
  output_dir: z.string().min(1),
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
