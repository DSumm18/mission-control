import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

const Body = z.object({
  source_id: z.string().uuid(),
  topic_area: z.enum(['finance','safeguarding','ofsted','estates','attendance','send','ai-policy','governance','other']),
  headline: z.string().min(3),
  summary: z.string().optional(),
  url: z.string().url(),
  published_at: z.string().optional(),
  dataset_name: z.string().optional(),
  verified_official: z.boolean().default(false),
  potential_newsletter_angle: z.string().optional(),
  impact_score: z.number().int().min(1).max(10).default(5),
});

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('mc_source_updates')
    .select('*, mc_signal_sources(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updates: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('mc_source_updates').insert({
      ...body,
      published_at: body.published_at || null,
    }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ update: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid payload' }, { status: 400 });
  }
}
