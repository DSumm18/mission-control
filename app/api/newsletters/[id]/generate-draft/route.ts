import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sb = supabaseAdmin();

  // Fetch newsletter
  const { data: newsletter, error: nlErr } = await sb
    .from('mc_newsletters')
    .select('*')
    .eq('id', id)
    .single();

  if (nlErr || !newsletter) {
    return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
  }

  // Get approved research items for this newsletter
  const { data: research } = await sb
    .from('mc_research_items')
    .select('*')
    .eq('newsletter_id', id)
    .eq('approved_for_draft', true);

  // Find Ed agent for decomposition
  const { data: ed } = await sb
    .from('mc_agents')
    .select('id')
    .eq('name', 'Ed')
    .single();

  // Queue Ed decomposition job
  const { data: decomposeJob, error: jobErr } = await sb
    .from('mc_jobs')
    .insert({
      title: `Decompose Draft: Week ${newsletter.week_no || '?'}`,
      command: 'draft_decompose',
      args: JSON.stringify({
        newsletter_id: id,
        newsletter_title: newsletter.title,
        week_no: newsletter.week_no,
        topic_category: newsletter.topic_category,
        research_items: (research || []).map(r => ({
          id: r.id,
          title: r.title,
          summary: r.summary,
          key_points: r.key_points,
          newsletter_angle: r.newsletter_angle,
          topic_area: r.topic_area,
          relevance_score: r.relevance_score,
        })),
      }),
      engine: 'claude',
      status: 'queued',
      priority: 'high',
      agent_id: ed?.id || null,
    })
    .select('id')
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  // Log pipeline event
  await sb.from('mc_pipeline_events').insert({
    newsletter_id: id,
    from_stage: newsletter.pipeline_status,
    to_stage: 'draft',
    triggered_by: 'david',
    job_id: decomposeJob?.id,
    notes: `Draft generation triggered with ${research?.length || 0} approved research items`,
  });

  // Update newsletter status if still in research
  if (newsletter.pipeline_status === 'research') {
    await sb.from('mc_newsletters')
      .update({ pipeline_status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  return NextResponse.json({
    job_id: decomposeJob?.id,
    research_count: research?.length || 0,
  }, { status: 201 });
}
