import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('mc_skills')
    .select('id,key,category,provider,status,cost_profile,notes,usage_guidelines,mcp_server_name,requires_api_key,created_at')
    .order('key', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ skills: data || [] });
}

const CreateBody = z.object({
  key: z.string().min(1),
  category: z.string().optional(),
  provider: z.string().optional(),
  status: z.enum(['enabled', 'disabled', 'pilot']).default('enabled'),
  cost_profile: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  usage_guidelines: z.string().nullable().optional(),
  mcp_server_name: z.string().nullable().optional(),
  requires_api_key: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateBody.parse(await req.json());
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from('mc_skills')
      .insert({
        key: body.key,
        category: body.category || null,
        provider: body.provider || null,
        status: body.status,
        cost_profile: body.cost_profile || null,
        notes: body.notes || null,
        usage_guidelines: body.usage_guidelines || null,
        mcp_server_name: body.mcp_server_name || null,
        requires_api_key: body.requires_api_key,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ skill: data }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
