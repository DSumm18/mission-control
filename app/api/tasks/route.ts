import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const projectId = url.searchParams.get('project_id');

  let query = sb
    .from('mc_tasks')
    .select('*, mc_projects(name)')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

const CreateBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  project_id: z.string().uuid().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).default('todo'),
  priority: z.number().int().min(1).max(10).default(5),
  due_date: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateBody.parse(await req.json());
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from('mc_tasks')
      .insert({
        title: body.title,
        description: body.description || null,
        project_id: body.project_id || null,
        status: body.status,
        priority: body.priority,
        due_date: body.due_date || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
