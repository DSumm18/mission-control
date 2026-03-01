import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const sb = supabaseAdmin();

  const { data: project, error } = await sb
    .from('mc_projects')
    .select('*, mc_agents!mc_projects_pm_agent_id_fkey(id, name, avatar_emoji)')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get recent jobs for this project
  const { data: jobs } = await sb
    .from('mc_jobs')
    .select('id, title, status, quality_score, agent_id, created_at, job_type')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ project, jobs: jobs || [] });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const body = await req.json();
  const sb = supabaseAdmin();

  const allowedFields = [
    'name', 'description', 'delivery_plan', 'pm_agent_id',
    'status', 'revenue_target_monthly', 'repo_path',
    'vercel_project_id', 'supabase_project_id',
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await sb
    .from('mc_projects')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
