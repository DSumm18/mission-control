import { supabaseAdmin } from '@/lib/db/supabase-server';

type DeliverableType = 'prd' | 'spec' | 'research' | 'analysis' | 'design' | 'other' | 'guide' | 'runbook' | 'architecture' | 'changelog';

const TITLE_PATTERNS: [RegExp, DeliverableType][] = [
  [/\bPRD\b/i, 'prd'],
  [/\bproduct\s+requirements?\b/i, 'prd'],
  [/\bspec(ification)?\b/i, 'spec'],
  [/\btechnical\s+spec\b/i, 'spec'],
  [/\bresearch\b/i, 'research'],
  [/\banalysis\b/i, 'analysis'],
  [/\bdesign\b/i, 'design'],
  [/\buser\s+guide\b/i, 'guide'],
  [/\bguide\b/i, 'guide'],
  [/\bdocumentation\b/i, 'guide'],
  [/\brunbook\b/i, 'runbook'],
  [/\bplaybook\b/i, 'runbook'],
  [/\barchitecture\b/i, 'architecture'],
  [/\bchangelog\b/i, 'changelog'],
  [/\brelease\s+notes?\b/i, 'changelog'],
];

function detectType(title: string, jobType: string | null): DeliverableType | null {
  if (jobType === 'pm') return 'prd';

  for (const [pattern, type] of TITLE_PATTERNS) {
    if (pattern.test(title)) return type;
  }

  return null;
}

/**
 * Called after a job completes with status 'done' and has a project_id.
 * Auto-creates a deliverable if the job title matches planning patterns.
 */
export async function maybeCreateDeliverable(
  job: Record<string, unknown>,
  result: string | null,
): Promise<boolean> {
  const projectId = job.project_id as string | null;
  const sourceJobId = job.id as string;
  const title = (job.title as string) || '';
  const jobType = (job.job_type as string) || null;

  if (!projectId || !result) return false;

  const type = detectType(title, jobType);
  if (!type) return false;

  const sb = supabaseAdmin();

  // Skip if deliverable already exists for this job (prevent duplicates)
  const { data: existing } = await sb
    .from('mc_project_deliverables')
    .select('id')
    .eq('source_job_id', sourceJobId)
    .limit(1)
    .maybeSingle();

  if (existing) return false;

  const { error } = await sb.from('mc_project_deliverables').insert({
    project_id: projectId,
    source_job_id: sourceJobId,
    title,
    deliverable_type: type,
    content: result,
    status: 'draft',
  });

  if (error) {
    console.error(`[auto-extract] Failed to create deliverable: ${error.message}`);
    return false;
  }

  return true;
}
