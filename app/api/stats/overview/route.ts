import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    projectsRes,
    activeJobsRes,
    runningJobsRes,
    agentsRes,
    reviewsRes,
    tasksRes,
  ] = await Promise.all([
    // Active projects with revenue targets
    sb.from('mc_projects')
      .select('revenue_target_monthly, status')
      .eq('status', 'active'),

    // Active jobs (running, queued, assigned)
    sb.from('mc_jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['running', 'queued', 'assigned']),

    // Running jobs to find active agents
    sb.from('mc_jobs')
      .select('agent_id')
      .eq('status', 'running'),

    // All active agents
    sb.from('mc_agents')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),

    // Recent reviews for quality average
    sb.from('mc_job_reviews')
      .select('total_score')
      .gte('created_at', sevenDaysAgo.toISOString()),

    // Tasks in todo status
    sb.from('mc_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'todo'),
  ]);

  // total_revenue_target: SUM of active projects' revenue_target_monthly
  const totalRevenueTarget = (projectsRes.data || []).reduce(
    (sum, p) => sum + (p.revenue_target_monthly || 0),
    0,
  );

  // active_agents: agents that are active AND currently running a job
  const runningAgentIds = new Set(
    (runningJobsRes.data || []).map((j) => j.agent_id).filter(Boolean),
  );
  // We need to check which of these are active agents
  let activeAgents = 0;
  if (runningAgentIds.size > 0) {
    const { count } = await sb
      .from('mc_agents')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .in('id', Array.from(runningAgentIds));
    activeAgents = count || 0;
  }

  // avg_quality_7d
  const scores = (reviewsRes.data || []).map((r) => r.total_score).filter((s) => s != null);
  const avgQuality7d = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  return NextResponse.json({
    total_revenue_target: totalRevenueTarget,
    active_jobs: activeJobsRes.count || 0,
    active_agents: activeAgents,
    total_agents: agentsRes.count || 0,
    avg_quality_7d: avgQuality7d,
    projects_active: (projectsRes.data || []).length,
    tasks_todo: tasksRes.count || 0,
  });
}
