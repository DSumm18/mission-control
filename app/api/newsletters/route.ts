import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const status = req.nextUrl.searchParams.get('status');

  let query = sb.from('mc_v_newsletter_quality').select('*');

  // Only show newsletters (not standalone tools/resources) by default
  query = query.eq('issue_type', 'newsletter');

  if (status) {
    query = query.eq('pipeline_status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = data || [];

  // Compute KPIs
  const published = items.filter((i) => i.pipeline_status === 'published').length;
  const inProgress = items.filter((i) => i.pipeline_status !== 'published').length;
  const scored = items.filter((i) => i.total_score_v2 != null);
  const avgQa = scored.length > 0
    ? Math.round(scored.reduce((a, i) => a + (i.total_score_v2 ?? 0), 0) / scored.length)
    : null;
  const toolsBuilt = items.filter((i) => i.tool_url).length;

  // Next publish date: earliest publish_date in the future, or earliest null
  const upcoming = items
    .filter((i) => i.pipeline_status !== 'published' && i.publish_date)
    .map((i) => i.publish_date)
    .sort();
  const nextPublish = upcoming[0] || null;

  return NextResponse.json({
    items,
    kpis: { total: items.length, published, inProgress, avgQa, toolsBuilt, nextPublish },
    threshold: 44,
    thresholdV2: 78,
  });
}

const CreateBody = z.object({
  title: z.string().min(3),
  week_no: z.number().int().positive().optional(),
  url: z.string().url(),
  topic_category: z.string().optional(),
  pipeline_status: z.enum(['research', 'draft', 'app_build', 'qa_review', 'approved', 'published']).default('research'),
  draft_version: z.string().optional(),
  tool_name: z.string().optional(),
  tool_decision: z.enum(['create_new', 'adapt_existing', 'reuse_existing', 'no_tool']).optional(),
  snippet_url: z.string().url().optional().or(z.literal('')),
  tool_url: z.string().url().optional().or(z.literal('')),
  publish_date: z.string().optional(),
  summary: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = CreateBody.parse(await req.json());
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from('mc_newsletters')
      .insert({
        title: body.title,
        week_no: body.week_no ?? null,
        issue_type: 'newsletter',
        url: body.url,
        topic_category: body.topic_category || null,
        pipeline_status: body.pipeline_status,
        draft_version: body.draft_version || null,
        tool_name: body.tool_name || null,
        tool_decision: body.tool_decision || null,
        snippet_url: body.snippet_url || null,
        tool_url: body.tool_url || null,
        publish_date: body.publish_date || null,
        summary: body.summary || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ newsletter: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid payload' }, { status: 400 });
  }
}
