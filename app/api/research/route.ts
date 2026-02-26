import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const sp = req.nextUrl.searchParams;

  let query = sb.from('mc_v_research_feed').select('*');

  const status = sp.get('status');
  if (status) query = query.eq('status', status);

  const topicArea = sp.get('topic_area');
  if (topicArea) query = query.eq('topic_area', topicArea);

  const newsletterId = sp.get('newsletter_id');
  if (newsletterId) query = query.eq('newsletter_id', newsletterId);

  const approved = sp.get('approved');
  if (approved === 'true') query = query.eq('approved_for_draft', true);
  if (approved === 'false') query = query.eq('approved_for_draft', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = data || [];

  // Status counts
  const counts = {
    total: items.length,
    captured: items.filter(i => i.status === 'captured').length,
    assessing: items.filter(i => i.status === 'assessing').length,
    assessed: items.filter(i => i.status === 'assessed').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
    used: items.filter(i => i.status === 'used').length,
  };

  return NextResponse.json({ items, counts });
}
