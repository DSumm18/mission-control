import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();

  const { data: departments, error } = await sb
    .from('mc_departments')
    .select('id, name, slug, sort_order')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get agent counts per department
  const { data: agents } = await sb
    .from('mc_agents')
    .select('department_id');

  const countMap = new Map<string, number>();
  for (const a of agents || []) {
    if (a.department_id) {
      countMap.set(a.department_id, (countMap.get(a.department_id) || 0) + 1);
    }
  }

  const result = (departments || []).map((d) => ({
    ...d,
    agent_count: countMap.get(d.id) || 0,
  }));

  return NextResponse.json({ departments: result });
}
