import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_v_research_feed')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Also fetch raw fields not in view (transcript, raw_content)
  const { data: full } = await sb
    .from('mc_research_items')
    .select('raw_content, transcript_text')
    .eq('id', id)
    .single();

  return NextResponse.json({
    item: { ...data, raw_content: full?.raw_content, transcript_text: full?.transcript_text },
  });
}

const ALLOWED_PATCH = [
  'status', 'approved_for_draft', 'newsletter_id', 'topic_area',
  'relevance_score', 'newsletter_angle', 'summary', 'key_points',
  'why_relevant', 'agent_assessment', 'assessed_by', 'assessed_at',
] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const body = await req.json();
    const sb = supabaseAdmin();

    const update: Record<string, unknown> = {};
    for (const field of ALLOWED_PATCH) {
      if (field in body) update[field] = body[field];
    }

    // If approving, set approved_for_draft too
    if (body.status === 'approved') {
      update.approved_for_draft = true;
    }
    if (body.status === 'rejected') {
      update.approved_for_draft = false;
    }

    const { data, error } = await sb
      .from('mc_research_items')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid payload';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
