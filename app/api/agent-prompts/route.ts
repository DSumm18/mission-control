import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const agentId = req.nextUrl.searchParams.get('agent_id');

  let query = sb
    .from('mc_agent_prompts')
    .select('*, mc_agents(name)')
    .order('created_at', { ascending: false });

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  const { data, error } = await query.limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompts: data || [] });
}

const CreateBody = z.object({
  agent_id: z.string().uuid(),
  system_prompt: z.string().min(1),
  activate: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateBody.parse(await req.json());
    const sb = supabaseAdmin();

    // Get next version number
    const { data: latest } = await sb
      .from('mc_agent_prompts')
      .select('version')
      .eq('agent_id', body.agent_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version || 0) + 1;

    // If activating, deactivate all others first
    if (body.activate) {
      await sb
        .from('mc_agent_prompts')
        .update({ active: false })
        .eq('agent_id', body.agent_id);
    }

    const { data: prompt, error } = await sb
      .from('mc_agent_prompts')
      .insert({
        agent_id: body.agent_id,
        version: nextVersion,
        system_prompt: body.system_prompt,
        active: body.activate,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If activating, also update the agent's system_prompt
    if (body.activate) {
      await sb
        .from('mc_agents')
        .update({ system_prompt: body.system_prompt })
        .eq('id', body.agent_id);
    }

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
