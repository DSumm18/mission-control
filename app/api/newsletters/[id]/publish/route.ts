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

  if (newsletter.pipeline_status === 'published') {
    return NextResponse.json({ error: 'Already published' }, { status: 400 });
  }

  // Find Publisher agent
  const { data: publisher } = await sb
    .from('mc_agents')
    .select('id')
    .eq('name', 'Publisher')
    .single();

  // Queue publish job (shell: git commit + push to schoolgle-tools)
  const { data: pubJob, error: jobErr } = await sb
    .from('mc_jobs')
    .insert({
      title: `Deploy: Week ${newsletter.week_no || '?'}`,
      command: 'deploy_newsletter',
      args: JSON.stringify({
        newsletter_id: id,
        week_no: newsletter.week_no,
        title: newsletter.title,
      }),
      engine: 'shell',
      status: 'queued',
      priority: 'high',
      agent_id: publisher?.id || null,
    })
    .select('id')
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  // Log pipeline event
  await sb.from('mc_pipeline_events').insert({
    newsletter_id: id,
    from_stage: newsletter.pipeline_status,
    to_stage: 'published',
    triggered_by: 'david',
    job_id: pubJob?.id,
    notes: 'Publish workflow triggered',
  });

  // Update newsletter status
  await sb.from('mc_newsletters')
    .update({
      pipeline_status: 'published',
      publish_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({
    job_id: pubJob?.id,
    status: 'published',
  }, { status: 201 });
}
