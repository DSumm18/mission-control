import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const sb = supabaseAdmin();

  const { data: agent, error } = await sb
    .from('mc_agents')
    .select('*, mc_departments(name, slug)')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  // Get reports_to name
  let reportsToName: string | null = null;
  if (agent.reports_to) {
    const { data: mgr } = await sb
      .from('mc_agents')
      .select('name')
      .eq('id', agent.reports_to)
      .single();
    reportsToName = mgr?.name || null;
  }

  // Get prompt versions
  const { data: prompts } = await sb
    .from('mc_agent_prompts')
    .select('id, version, active, performance_delta, created_at')
    .eq('agent_id', id)
    .order('version', { ascending: false });

  // Get recent reviews for this agent's jobs
  const { data: reviews } = await sb
    .from('mc_job_reviews')
    .select('id, job_id, total_score, passed, feedback, created_at')
    .in(
      'job_id',
      (await sb.from('mc_jobs').select('id').eq('agent_id', id)).data?.map((j) => j.id) || []
    )
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    agent: { ...agent, reports_to_name: reportsToName },
    prompts: prompts || [],
    reviews: reviews || [],
  });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const body = await req.json();
  const sb = supabaseAdmin();

  const allowedFields = [
    'name', 'role', 'default_engine', 'fallback_engine', 'model_hint', 'model_id',
    'active', 'notes', 'system_prompt', 'department_id', 'reports_to',
    'cost_tier', 'avatar_emoji',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('mc_agents')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: data });
}
