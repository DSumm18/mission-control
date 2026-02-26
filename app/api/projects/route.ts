import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();

  const { data: projects, error } = await sb
    .from('mc_projects')
    .select('*, mc_agents!mc_projects_pm_agent_id_fkey(id, name, avatar_emoji)')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get active job counts per project
  const { data: jobCounts } = await sb
    .from('mc_jobs')
    .select('project_id, status')
    .not('project_id', 'is', null);

  const activeMap = new Map<string, number>();
  const doneMap = new Map<string, number>();
  for (const j of jobCounts || []) {
    if (!j.project_id) continue;
    if (j.status === 'done') {
      doneMap.set(j.project_id, (doneMap.get(j.project_id) || 0) + 1);
    } else if (j.status !== 'failed') {
      activeMap.set(j.project_id, (activeMap.get(j.project_id) || 0) + 1);
    }
  }

  const result = (projects || []).map((p) => ({
    ...p,
    active_jobs: activeMap.get(p.id) || 0,
    done_jobs: doneMap.get(p.id) || 0,
  }));

  return NextResponse.json({ projects: result });
}

const CreateBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  delivery_plan: z.record(z.unknown()).default({}),
  pm_agent_id: z.string().uuid().nullable().default(null),
  status: z.enum(['active', 'paused', 'done']).default('active'),
  revenue_target_monthly: z.number().nullable().default(null),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateBody.parse(await req.json());
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from('mc_projects')
      .insert(body)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
