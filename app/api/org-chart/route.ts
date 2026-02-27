import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_v_org_chart')
    .select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with skill assignments
  const agents = data || [];
  const agentIds = agents.map((a: { agent_id: string }) => a.agent_id);

  const { data: skillData } = await sb
    .from('mc_agent_skills')
    .select('agent_id, mc_skills(key, category, status)')
    .in('agent_id', agentIds);

  // Group skills by agent
  const skillsByAgent = new Map<string, string[]>();
  for (const s of skillData || []) {
    const skill = s.mc_skills as unknown as { key: string; category: string; status: string } | null;
    if (!skill) continue;
    const list = skillsByAgent.get(s.agent_id) || [];
    list.push(skill.key);
    skillsByAgent.set(s.agent_id, list);
  }

  const enriched = agents.map((a: { agent_id: string }) => ({
    ...a,
    skills: skillsByAgent.get(a.agent_id) || [],
  }));

  return NextResponse.json({ agents: enriched });
}
