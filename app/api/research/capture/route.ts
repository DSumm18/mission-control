import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { buildScoutAssessmentPrompt } from '@/lib/newsletter/research-prompts';

const CaptureBody = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  topic_hint: z.string().optional(),
  notes: z.string().optional(),
  shared_by: z.string().default('david'),
});

function detectContentType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('gov.uk')) return 'govuk';
  if (u.endsWith('.pdf')) return 'pdf';
  if (u.includes('twitter.com') || u.includes('x.com') || u.includes('linkedin.com')) return 'social';
  return 'article';
}

export async function POST(req: NextRequest) {
  try {
    const body = CaptureBody.parse(await req.json());
    const sb = supabaseAdmin();
    const contentType = detectContentType(body.url);

    // Create research item
    const { data: item, error: insertErr } = await sb
      .from('mc_research_items')
      .upsert({
        source_url: body.url,
        title: body.title || null,
        content_type: contentType,
        topic_area: body.topic_hint || null,
        shared_by: body.shared_by,
        status: 'captured',
        why_relevant: body.notes || null,
      }, { onConflict: 'source_url' })
      .select('*')
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    const queuedJobs: string[] = [];

    // For YouTube: queue shell job to extract transcript first
    if (contentType === 'youtube') {
      const { data: shellJob } = await sb
        .from('mc_jobs')
        .insert({
          title: `Transcript Extract: ${body.title || body.url}`,
          command: 'youtube_transcript',
          args: JSON.stringify({ url: body.url, research_item_id: item.id }),
          engine: 'shell',
          status: 'queued',
          priority: 'high',
        })
        .select('id')
        .single();

      if (shellJob) {
        await sb.from('mc_research_items')
          .update({ capture_job_id: shellJob.id })
          .eq('id', item.id);
        queuedJobs.push(shellJob.id);
      }
    }

    // Queue Scout assessment job
    const promptInput = {
      title: body.title || '(untitled)',
      sourceUrl: body.url,
      contentType,
      topicHint: body.topic_hint,
    };

    // Find Scout agent
    const { data: scout } = await sb
      .from('mc_agents')
      .select('id')
      .eq('name', 'Scout')
      .single();

    const { data: assessJob } = await sb
      .from('mc_jobs')
      .insert({
        title: `Assess: ${body.title || body.url}`,
        command: 'research_assessment',
        args: JSON.stringify({
          research_item_id: item.id,
          prompt: buildScoutAssessmentPrompt(promptInput),
        }),
        engine: 'claude',
        status: contentType === 'youtube' ? 'pending' : 'queued',
        priority: 'normal',
        agent_id: scout?.id || null,
      })
      .select('id')
      .single();

    if (assessJob) {
      await sb.from('mc_research_items')
        .update({
          assessment_job_id: assessJob.id,
          status: 'assessing',
        })
        .eq('id', item.id);
      queuedJobs.push(assessJob.id);
    }

    return NextResponse.json({
      item,
      content_type: contentType,
      queued_jobs: queuedJobs,
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid payload';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
