import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { buildScoutAssessmentPrompt } from '@/lib/newsletter/research-prompts';

const BridgeBody = z.object({
  source_update_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = BridgeBody.parse(await req.json());
    const sb = supabaseAdmin();

    // Fetch the source update
    const { data: su, error: suErr } = await sb
      .from('mc_source_updates')
      .select('*, mc_signal_sources(name, source_type, domain)')
      .eq('id', body.source_update_id)
      .single();

    if (suErr || !su) {
      return NextResponse.json({ error: 'Source update not found' }, { status: 404 });
    }

    // Detect content type from source domain
    const domain = su.mc_signal_sources?.domain || '';
    let contentType = 'article';
    if (domain.includes('youtube')) contentType = 'youtube';
    else if (domain.includes('gov.uk')) contentType = 'govuk';

    // Check for existing transcript file
    let transcriptText: string | null = null;
    if (contentType === 'youtube' && su.url) {
      // Video ID from URL
      const match = su.url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        const videoId = match[1];
        try {
          const fs = await import('fs/promises');
          transcriptText = await fs.readFile(
            `${process.cwd()}/data/transcripts/${videoId}.txt`,
            'utf-8'
          );
        } catch {
          // No transcript file yet — that's fine
        }
      }
    }

    // Upsert research item
    const { data: item, error: insertErr } = await sb
      .from('mc_research_items')
      .upsert({
        source_url: su.url,
        title: su.headline,
        content_type: contentType,
        topic_area: su.topic_area || null,
        summary: su.summary || null,
        transcript_text: transcriptText,
        shared_by: 'system',
        status: 'captured',
      }, { onConflict: 'source_url' })
      .select('*')
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Queue Scout assessment
    const { data: scout } = await sb
      .from('mc_agents')
      .select('id')
      .eq('name', 'Scout')
      .single();

    const { data: assessJob } = await sb
      .from('mc_jobs')
      .insert({
        title: `Assess: ${su.headline || su.url}`,
        command: 'research_assessment',
        args: JSON.stringify({
          research_item_id: item.id,
          prompt: buildScoutAssessmentPrompt({
            title: su.headline || '(untitled)',
            sourceUrl: su.url,
            contentType,
            transcriptText: transcriptText || undefined,
            topicHint: su.topic_area || undefined,
          }),
        }),
        engine: 'claude',
        status: 'queued',
        priority: 'normal',
        agent_id: scout?.id || null,
      })
      .select('id')
      .single();

    if (assessJob) {
      await sb.from('mc_research_items')
        .update({ assessment_job_id: assessJob.id, status: 'assessing' })
        .eq('id', item.id);
    }

    return NextResponse.json({
      item,
      assessment_job_id: assessJob?.id || null,
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid payload';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
