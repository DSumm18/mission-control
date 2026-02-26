import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { buildVoiceCheckPrompt } from '@/lib/newsletter/voice-prompts';

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

  // Get latest draft
  const { data: drafts } = await sb
    .from('mc_newsletter_drafts')
    .select('*')
    .eq('newsletter_id', id)
    .order('version', { ascending: false })
    .limit(1);

  const draft = drafts?.[0];
  if (!draft) {
    return NextResponse.json({ error: 'No draft found for this newsletter' }, { status: 404 });
  }

  // Find Inspector agent
  const { data: inspector } = await sb
    .from('mc_agents')
    .select('id')
    .eq('name', 'Inspector')
    .single();

  // Queue voice check job
  const voicePrompt = buildVoiceCheckPrompt({
    weekNo: newsletter.week_no || 0,
    draftVersion: draft.version,
    fullMarkdown: draft.full_markdown || '',
  });

  const { data: qaJob, error: jobErr } = await sb
    .from('mc_jobs')
    .insert({
      title: `QA Review: Week ${newsletter.week_no || '?'} v${draft.version}`,
      command: 'qa_review',
      args: JSON.stringify({
        newsletter_id: id,
        draft_id: draft.id,
        prompt: voicePrompt,
      }),
      engine: 'claude',
      status: 'queued',
      priority: 'high',
      agent_id: inspector?.id || null,
    })
    .select('id')
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  // Log pipeline event
  await sb.from('mc_pipeline_events').insert({
    newsletter_id: id,
    from_stage: newsletter.pipeline_status,
    to_stage: 'qa_review',
    triggered_by: 'david',
    job_id: qaJob?.id,
    notes: `Auto QA triggered for draft v${draft.version}`,
  });

  // Update pipeline status if needed
  if (newsletter.pipeline_status === 'draft' || newsletter.pipeline_status === 'app_build') {
    await sb.from('mc_newsletters')
      .update({ pipeline_status: 'qa_review', updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  return NextResponse.json({
    job_id: qaJob?.id,
    draft_version: draft.version,
  }, { status: 201 });
}
