import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

const ALLOWED_PATCH_FIELDS = [
  'pipeline_status', 'draft_version', 'tool_name', 'tool_url',
  'snippet_url', 'publish_date', 'summary', 'notes', 'tool_decision',
  'topic_category',
] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = supabaseAdmin();

  // Fetch newsletter from view (includes latest review + source count)
  const { data: newsletter, error } = await sb
    .from('mc_v_newsletter_quality')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Fetch ALL reviews (not just latest)
  const { data: reviews } = await sb
    .from('mc_newsletter_reviews')
    .select('*')
    .eq('newsletter_id', id)
    .order('created_at', { ascending: false });

  // Fetch linked sources with source names
  const { data: sources } = await sb
    .from('mc_newsletter_sources')
    .select('*, mc_source_updates(id, headline, topic_area, url, mc_signal_sources(name))')
    .eq('newsletter_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    newsletter,
    reviews: reviews || [],
    sources: sources || [],
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const body = await req.json();
    const sb = supabaseAdmin();

    // Whitelist allowed fields
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_PATCH_FIELDS) {
      if (field in body) {
        update[field] = body[field];
      }
    }

    // Validate pipeline_status if provided
    if (update.pipeline_status) {
      const valid = ['research', 'draft', 'app_build', 'qa_review', 'approved', 'published'];
      if (!valid.includes(update.pipeline_status as string)) {
        return NextResponse.json({ error: 'Invalid pipeline_status' }, { status: 400 });
      }
    }

    const { data, error } = await sb
      .from('mc_newsletters')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ newsletter: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid payload' }, { status: 400 });
  }
}
