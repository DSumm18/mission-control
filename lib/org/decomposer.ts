import { supabaseAdmin } from '@/lib/db/supabase-server';

type SubTask = {
  title: string;
  suggested_agent: string;
  priority: number;
  estimated_engine: string;
  prompt_text: string;
};

type DecomposeResult = {
  job_ids: string[];
  sub_tasks: SubTask[];
};

/**
 * Ed's decomposition function. Takes a job, produces structured sub-tasks.
 * Creates mc_jobs for each with parent_job_id set.
 * Returns created job IDs.
 *
 * In production, this calls Claude Haiku with a structured prompt.
 * For now, it accepts pre-composed sub-tasks (from the API caller or Ed's output).
 */
export async function decomposeJob(
  parentJobId: string,
  subTasks: SubTask[]
): Promise<DecomposeResult> {
  const sb = supabaseAdmin();

  // Get parent job for context
  const { data: parentJob } = await sb
    .from('mc_jobs')
    .select('id, project_id, engine, repo_path, output_dir')
    .eq('id', parentJobId)
    .single();

  if (!parentJob) throw new Error('Parent job not found');

  // Resolve agent names to IDs
  const agentNames = [...new Set(subTasks.map((t) => t.suggested_agent))];
  const { data: agents } = await sb
    .from('mc_agents')
    .select('id, name')
    .in('name', agentNames);

  const agentMap = new Map<string, string>();
  for (const a of agents || []) {
    agentMap.set(a.name, a.id);
  }

  // Create sub-task jobs
  const jobIds: string[] = [];
  for (const task of subTasks) {
    const agentId = agentMap.get(task.suggested_agent) || null;

    const { data: created, error } = await sb
      .from('mc_jobs')
      .insert({
        title: task.title,
        engine: task.estimated_engine,
        repo_path: parentJob.repo_path,
        prompt_text: task.prompt_text,
        output_dir: parentJob.output_dir,
        status: 'queued',
        parent_job_id: parentJobId,
        project_id: parentJob.project_id,
        agent_id: agentId,
        priority: task.priority,
        job_type: 'task',
        source: 'orchestrator',
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create sub-task: ${error.message}`);
    jobIds.push(created!.id);
  }

  // Update parent job type to decomposition
  await sb
    .from('mc_jobs')
    .update({ job_type: 'decomposition' })
    .eq('id', parentJobId);

  return { job_ids: jobIds, sub_tasks: subTasks };
}

/**
 * Build the structured prompt for Ed to decompose a job.
 * This prompt asks Claude Haiku to return a JSON array of sub-tasks.
 */
export function buildDecompositionPrompt(job: {
  title: string;
  prompt_text: string | null;
  project_name?: string | null;
}): string {
  return `You are Ed, the Chief Orchestrator. Decompose this job into sub-tasks.

## Job to Decompose
**Title:** ${job.title}
${job.prompt_text ? `**Description:** ${job.prompt_text}` : ''}
${job.project_name ? `**Project:** ${job.project_name}` : ''}

## Available Agents
- Scout (researcher, haiku) — fast discovery, 3-5 bullet findings
- Hawk (researcher, haiku) — deep multi-source analysis, 500+ word reports
- Pulse (researcher, haiku) — market trends, competitor signals, has Gmail
- Chip (product, haiku) — PRDs, feature specs, user stories
- Principal (product, haiku) — UK education domain, Schoolgle specialist
- Melody (product, sonnet) — music industry, MySongs specialist
- Builder (engineering, sonnet) — production code, has Supabase + Vercel + Context7
- Pixel (creative, sonnet) — UI/UX design, visual assets, has Vercel
- Megaphone (marketing, sonnet) — copy, social posts, email campaigns
- Publisher (operations, shell) — deploy, git ops, ZERO LLM cost
- Sentinel (operations, haiku) — security monitoring, log auditing
- Abacus (finance, haiku) — budgets, cashflow, ROI projections, has Supabase

## Output Format
Return ONLY a JSON array of sub-tasks:
[
  {
    "title": "short descriptive title",
    "suggested_agent": "agent name from list above",
    "priority": 1-10 (1=highest),
    "estimated_engine": "claude" or "shell",
    "prompt_text": "clear instructions for the agent"
  }
]

Decompose into the MINIMUM number of sub-tasks needed. Each sub-task should be independently executable.`;
}
