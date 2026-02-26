import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_v_agent_performance')
    .select('*')
    .eq('agent_id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  return NextResponse.json({ performance: data });
}
