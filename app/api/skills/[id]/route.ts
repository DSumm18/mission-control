import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

const PatchBody = z.object({
  category: z.string().optional(),
  provider: z.string().optional(),
  status: z.enum(['enabled', 'disabled', 'pilot']).optional(),
  cost_profile: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  usage_guidelines: z.string().nullable().optional(),
  mcp_server_name: z.string().nullable().optional(),
  requires_api_key: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  try {
    const body = PatchBody.parse(await req.json());
    const sb = supabaseAdmin();

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('mc_skills')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    return NextResponse.json({ skill: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
