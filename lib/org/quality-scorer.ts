import { supabaseAdmin } from '@/lib/db/supabase-server';

export type QAScores = {
  completeness: number;
  accuracy: number;
  actionability: number;
  revenue_relevance: number;
  evidence: number;
};

export type QAResult = {
  passed: boolean;
  total: number;
  feedback: string;
  review_id: string;
};

/**
 * Score a job on 5 dimensions (1-10 each, total /50).
 * Checks threshold from mc_settings, inserts review row,
 * updates agent quality_score_avg (rolling avg of last 20).
 */
export async function scoreJob(
  jobId: string,
  reviewerAgentId: string | null,
  scores: QAScores,
  feedback: string
): Promise<QAResult> {
  const sb = supabaseAdmin();

  const total =
    scores.completeness +
    scores.accuracy +
    scores.actionability +
    scores.revenue_relevance +
    scores.evidence;

  // Get pass threshold from settings
  const { data: setting } = await sb
    .from('mc_settings')
    .select('value')
    .eq('key', 'qa_pass_threshold')
    .single();

  const threshold = setting?.value ? Number(setting.value) : 35;
  const passed = total >= threshold;

  // Insert review row
  const { data: review, error: reviewErr } = await sb
    .from('mc_job_reviews')
    .insert({
      job_id: jobId,
      reviewer_agent_id: reviewerAgentId,
      completeness: scores.completeness,
      accuracy: scores.accuracy,
      actionability: scores.actionability,
      revenue_relevance: scores.revenue_relevance,
      evidence: scores.evidence,
      passed,
      feedback,
    })
    .select('id')
    .single();

  if (reviewErr) throw new Error(`Failed to insert review: ${reviewErr.message}`);

  // Update job quality_score and review_notes
  await sb
    .from('mc_jobs')
    .update({
      quality_score: total,
      review_notes: feedback,
      status: passed ? 'done' : 'rejected',
    })
    .eq('id', jobId);

  // Get the job's agent to update their rolling average
  const { data: job } = await sb
    .from('mc_jobs')
    .select('agent_id')
    .eq('id', jobId)
    .single();

  if (job?.agent_id) {
    // Get last 20 reviews for this agent's jobs
    const { data: recentReviews } = await sb
      .from('mc_job_reviews')
      .select('total_score, job_id')
      .in(
        'job_id',
        (
          await sb
            .from('mc_jobs')
            .select('id')
            .eq('agent_id', job.agent_id)
        ).data?.map((j) => j.id) || []
      )
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentReviews && recentReviews.length > 0) {
      const avg =
        recentReviews.reduce((sum, r) => sum + (r.total_score || 0), 0) /
        recentReviews.length;

      const updateFields: Record<string, unknown> = {
        quality_score_avg: Math.round(avg * 100) / 100,
      };

      if (passed) {
        updateFields.consecutive_failures = 0;
        // Increment total_jobs_completed
        const { data: agent } = await sb
          .from('mc_agents')
          .select('total_jobs_completed')
          .eq('id', job.agent_id)
          .single();
        updateFields.total_jobs_completed = (agent?.total_jobs_completed || 0) + 1;
      } else {
        // Increment consecutive_failures
        const { data: agent } = await sb
          .from('mc_agents')
          .select('consecutive_failures')
          .eq('id', job.agent_id)
          .single();
        updateFields.consecutive_failures = (agent?.consecutive_failures || 0) + 1;
      }

      await sb.from('mc_agents').update(updateFields).eq('id', job.agent_id);
    }
  }

  return {
    passed,
    total,
    feedback,
    review_id: review!.id,
  };
}
