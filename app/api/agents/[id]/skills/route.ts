import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: agentId } = await ctx.params;
  const sb = supabaseAdmin();

  // Get all skills
  const { data: skills, error: skillsErr } = await sb
    .from('mc_skills')
    .select('id, key, category, provider, status, cost_profile, notes, mcp_server_name, requires_api_key, created_at')
    .order('key', { ascending: true });

  if (skillsErr) return NextResponse.json({ error: skillsErr.message }, { status: 500 });

  // Get this agent's assigned skill IDs
  const { data: assignments, error: assignErr } = await sb
    .from('mc_agent_skills')
    .select('skill_id')
    .eq('agent_id', agentId);

  if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 });

  const assignedIds = new Set((assignments || []).map((a) => a.skill_id));

  const result = (skills || []).map((skill) => ({
    ...skill,
    assigned: assignedIds.has(skill.id),
  }));

  return NextResponse.json({ skills: result });
}

const ToggleBody = z.object({
  skill_id: z.string().uuid(),
  assigned: z.boolean(),
});

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: agentId } = await ctx.params;

  try {
    const body = ToggleBody.parse(await req.json());
    const sb = supabaseAdmin();

    if (body.assigned) {
      // Assign skill to agent
      const { error } = await sb
        .from('mc_agent_skills')
        .insert({ agent_id: agentId, skill_id: body.skill_id });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Remove skill from agent
      const { error } = await sb
        .from('mc_agent_skills')
        .delete()
        .eq('agent_id', agentId)
        .eq('skill_id', body.skill_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, skill_id: body.skill_id, assigned: body.assigned });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
