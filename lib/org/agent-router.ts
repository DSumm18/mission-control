import { supabaseAdmin } from '@/lib/db/supabase-server';

export type RouteResult = {
  agent_id: string;
  agent_name: string;
  reason: string;
};

/**
 * Given a job, select the best agent by:
 * 1. Department match (if job has project -> project's PM department preferred)
 * 2. Skill match (agents with relevant skills)
 * 3. Cost tier (cheapest first)
 * 4. Quality score (highest first)
 * 5. Current load (fewest running jobs)
 * 6. Active status (must be active)
 */
export async function routeJob(jobId: string): Promise<RouteResult | null> {
  const sb = supabaseAdmin();

  const { data: job } = await sb
    .from('mc_jobs')
    .select('id, title, engine, job_type, project_id')
    .eq('id', jobId)
    .single();

  if (!job) return null;

  // Get all active agents
  const { data: agents } = await sb
    .from('mc_agents')
    .select('id, name, role, default_engine, cost_tier, quality_score_avg, department_id')
    .eq('active', true)
    .order('quality_score_avg', { ascending: false });

  if (!agents || agents.length === 0) return null;

  // Get running job counts per agent
  const { data: loadData } = await sb
    .from('mc_jobs')
    .select('agent_id')
    .in('status', ['running', 'assigned']);

  const loadMap = new Map<string, number>();
  for (const row of loadData || []) {
    if (row.agent_id) {
      loadMap.set(row.agent_id, (loadMap.get(row.agent_id) || 0) + 1);
    }
  }

  // Determine preferred department if project exists
  let preferredDeptId: string | null = null;
  if (job.project_id) {
    const { data: project } = await sb
      .from('mc_projects')
      .select('pm_agent_id')
      .eq('id', job.project_id)
      .single();

    if (project?.pm_agent_id) {
      const pm = agents.find((a) => a.id === project.pm_agent_id);
      if (pm) preferredDeptId = pm.department_id;
    }
  }

  // Map engine to expected role
  const engineRoleMap: Record<string, string[]> = {
    claude: ['coder', 'researcher', 'orchestrator', 'qa', 'ops', 'publisher'],
    shell: ['publisher', 'ops'],
  };

  // Review jobs go to Inspector (qa role)
  if (job.job_type === 'review') {
    const inspector = agents.find((a) => a.role === 'qa');
    if (inspector) {
      return { agent_id: inspector.id, agent_name: inspector.name, reason: 'QA review assignment' };
    }
  }

  // Decomposition/integration jobs go to Ed (orchestrator)
  if (job.job_type === 'decomposition' || job.job_type === 'integration') {
    const ed = agents.find((a) => a.role === 'orchestrator');
    if (ed) {
      return { agent_id: ed.id, agent_name: ed.name, reason: 'Orchestrator assignment' };
    }
  }

  // Keyword-based routing for specialist agents
  const titleLower = (job.title || '').toLowerCase();
  const keywordRoutes: { keywords: string[]; role: string; reason: string }[] = [
    { keywords: ['budget', 'cashflow', 'revenue', 'roi', 'finance', 'cost', 'projection', 'reconcil'], role: 'analyst', reason: 'Finance keyword match' },
    { keywords: ['security', 'audit', 'vulnerab', 'monitor', 'breach', 'rls', 'permission'], role: 'ops', reason: 'Security keyword match' },
  ];

  for (const route of keywordRoutes) {
    if (route.keywords.some((kw) => titleLower.includes(kw))) {
      const match = agents.find((a) => a.role === route.role);
      if (match) {
        return { agent_id: match.id, agent_name: match.name, reason: route.reason };
      }
    }
  }

  const costOrder: Record<string, number> = { free: 0, low: 1, medium: 2, high: 3 };

  // Score each agent
  const scored = agents
    .filter((a) => a.role !== 'orchestrator') // Ed never does tasks
    .filter((a) => {
      // Engine compatibility
      if (job.engine === 'shell') return a.default_engine === 'shell';
      return a.default_engine === job.engine || a.default_engine === 'claude';
    })
    .map((a) => {
      let score = 0;

      // Department match bonus
      if (preferredDeptId && a.department_id === preferredDeptId) score += 10;

      // Cost preference (cheaper = higher score)
      score += (3 - (costOrder[a.cost_tier || 'medium'] || 2)) * 2;

      // Quality score bonus
      score += Number(a.quality_score_avg || 0);

      // Lower load = higher score
      const load = loadMap.get(a.id) || 0;
      score -= load * 3;

      return { ...a, score, load };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const best = scored[0];
  return {
    agent_id: best.id,
    agent_name: best.name,
    reason: `Best match: dept=${preferredDeptId === best.department_id ? 'yes' : 'no'}, cost=${best.cost_tier}, quality=${best.quality_score_avg}, load=${best.load}`,
  };
}
