import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: drafts, error } = await sb
    .from('mc_newsletter_drafts')
    .select('*')
    .eq('newsletter_id', id)
    .order('version', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get sections for the latest draft
  let sections: unknown[] = [];
  if (drafts && drafts.length > 0) {
    const { data: secs } = await sb
      .from('mc_newsletter_sections')
      .select('*')
      .eq('draft_id', drafts[0].id)
      .order('sort_order');
    sections = secs || [];
  }

  return NextResponse.json({ drafts: drafts || [], sections });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const body = await req.json();
    const sb = supabaseAdmin();

    // Get next version number
    const { data: existing } = await sb
      .from('mc_newsletter_drafts')
      .select('version')
      .eq('newsletter_id', id)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (existing?.[0]?.version || 0) + 1;

    const { data: draft, error } = await sb
      .from('mc_newsletter_drafts')
      .insert({
        newsletter_id: id,
        version: nextVersion,
        full_markdown: body.full_markdown || null,
        status: 'draft',
        david_notes: body.david_notes || null,
        generated_by: body.generated_by || null,
        generation_job_id: body.generation_job_id || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid payload';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
