/**
 * Auto-dispatch — checks for stalled/failed jobs and auto-actions.
 * Called from run-once after each job execution.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';

const STALL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RETRIES = 3;
const RESEARCH_STALE_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONSECUTIVE_FAILURES = 3;

export async function checkAutoDispatch(): Promise<void> {
  const sb = supabaseAdmin();

  try {
    // 1. Stalled jobs (running > 10 min) → alert notification
    const { data: stalledJobs } = await sb
      .from('mc_jobs')
      .select('id, title, started_at, agent_id')
      .eq('status', 'running')
      .not('started_at', 'is', null);

    if (stalledJobs) {
      const now = Date.now();
      for (const j of stalledJobs) {
        const elapsed = now - new Date(j.started_at!).getTime();
        if (elapsed > STALL_TIMEOUT_MS) {
          // Check if we already have a stall notification for this job
          const { data: existing } = await sb
            .from('mc_ed_notifications')
            .select('id')
            .eq('metadata->>job_id', j.id)
            .eq('category', 'alert')
            .in('status', ['pending', 'delivered'])
            .limit(1);

          if (!existing?.length) {
            await sb.from('mc_ed_notifications').insert({
              title: `Stalled job: ${j.title}`,
              body: `Running for ${Math.round(elapsed / 60000)} minutes. May need investigation.`,
              category: 'alert',
              priority: 'high',
              status: 'pending',
              metadata: { job_id: j.id, type: 'stalled_job' },
            });
          }
        }
      }
    }

    // 2. Failed jobs with retry_count < MAX_RETRIES → auto-requeue
    const { data: failedJobs } = await sb
      .from('mc_jobs')
      .select('id, title, prompt_text, engine, project_id, agent_id, repo_path, priority, job_type, retry_count')
      .eq('status', 'failed')
      .lt('retry_count', MAX_RETRIES)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (failedJobs) {
      for (const j of failedJobs) {
        // Only auto-retry if retry_count column exists and is < MAX_RETRIES
        const retryCount = (j.retry_count ?? 0) + 1;

        await sb
          .from('mc_jobs')
          .update({
            status: 'queued',
            retry_count: retryCount,
            started_at: null,
            completed_at: null,
            result: null,
          })
          .eq('id', j.id);

        await sb.from('mc_ed_notifications').insert({
          title: `Auto-retry: ${j.title} (attempt ${retryCount}/${MAX_RETRIES})`,
          body: `Job failed and was automatically requeued.`,
          category: 'info',
          priority: 'normal',
          status: 'pending',
          metadata: { job_id: j.id, type: 'auto_retry', retry_count: retryCount },
        });
      }
    }

    // 3. Research items stale in 'captured' → auto-dispatch Scout
    const { data: staleResearch } = await sb
      .from('mc_research_items')
      .select('id, title, url, content_type')
      .eq('status', 'captured')
      .lt('created_at', new Date(Date.now() - RESEARCH_STALE_MS).toISOString())
      .limit(3);

    if (staleResearch?.length) {
      for (const r of staleResearch) {
        // Check if a Scout job already exists for this research item
        const { data: existingJob } = await sb
          .from('mc_jobs')
          .select('id')
          .ilike('title', `%${r.id}%`)
          .in('status', ['queued', 'running'])
          .limit(1);

        if (!existingJob?.length) {
          await sb.from('mc_jobs').insert({
            title: `Scout: ${r.title || r.url || 'Research item'}`,
            prompt_text: `Assess this research item for newsletter relevance. Research item ID: ${r.id}. Title: ${r.title}. URL: ${r.url || 'N/A'}. Content type: ${r.content_type}.`,
            engine: 'claude',
            status: 'queued',
            priority: 7,
            job_type: 'task',
            source: 'auto-dispatch',
          });
        }
      }
    }

    // 4. Agent consecutive_failures >= MAX_CONSECUTIVE_FAILURES → auto-pause + notify
    const { data: troubleAgents } = await sb
      .from('mc_agents')
      .select('id, name, consecutive_failures')
      .eq('status', 'active')
      .gte('consecutive_failures', MAX_CONSECUTIVE_FAILURES);

    if (troubleAgents?.length) {
      for (const a of troubleAgents) {
        await sb
          .from('mc_agents')
          .update({ status: 'paused' })
          .eq('id', a.id);

        await sb.from('mc_ed_notifications').insert({
          title: `Agent paused: ${a.name}`,
          body: `${a.consecutive_failures} consecutive failures. Paused automatically. Review and reactivate when ready.`,
          category: 'alert',
          priority: 'high',
          status: 'pending',
          metadata: { agent_id: a.id, type: 'agent_paused', failures: a.consecutive_failures },
        });
      }
    }
  } catch (err: unknown) {
    console.error('[auto-dispatch] Error:', err instanceof Error ? err.message : err);
  }
}
