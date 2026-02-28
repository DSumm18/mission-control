/**
 * Launch Claude Code for a project.
 *
 * POST /api/projects/[id]/launch-claude
 * Body: { task: string, mode?: 'autonomous' | 'interactive' }
 *
 * Autonomous (default): Creates an mc_jobs entry with project context.
 * Scheduler picks it up and runs via ag_run.sh in the project repo.
 *
 * Interactive: Spawns claude --worktree --tmux in the project repo (Mac Mini).
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { existsSync } from 'fs';
import { parseProjectSpec, formatSpecForPrompt } from '@/lib/org/project-spec';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = supabaseAdmin();

  let body: { task?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const task = body.task?.trim();
  if (!task) {
    return Response.json({ error: 'task is required' }, { status: 400 });
  }

  // Get project
  const { data: project, error } = await sb
    .from('mc_projects')
    .select('id, name, repo_path, delivery_plan, description, revenue_target_monthly')
    .eq('id', id)
    .single();

  if (error || !project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!project.repo_path) {
    return Response.json({ error: 'No repo_path set for this project. Set it in project settings.' }, { status: 400 });
  }

  // Validate repo path exists
  if (!existsSync(project.repo_path)) {
    return Response.json({ error: `Repo path does not exist: ${project.repo_path}` }, { status: 400 });
  }

  const mode = body.mode === 'interactive' ? 'interactive' : 'autonomous';

  if (mode === 'autonomous') {
    // Build a rich prompt with full project specification
    const spec = parseProjectSpec(project.delivery_plan);
    const specBlock = formatSpecForPrompt(spec, project.name, {
      includeConstraints: true,
      activeMilestoneOnly: false,
    });

    // Find the active milestone for focused instructions
    const activeMilestone = spec.milestones.find(m => m.status !== 'done');

    const workingInstructions: string[] = [
      'Work in the project repo. Make changes, run tests, and commit when done.',
    ];
    if (spec.evaluation?.build_must_pass) {
      workingInstructions.push('Build MUST pass before committing any changes.');
    }
    if (spec.evaluation?.test_command) {
      workingInstructions.push(`Run tests: \`${spec.evaluation.test_command}\``);
    }
    if (spec.evaluation?.verify_url) {
      workingInstructions.push(`Verify the app at: ${spec.evaluation.verify_url}`);
    }
    workingInstructions.push('If you encounter issues, document them clearly.');

    const promptParts: string[] = [
      `You are working on the project "${project.name}".`,
      `Repo path: ${project.repo_path}`,
    ];
    if (project.description) promptParts.push(`Description: ${project.description}`);
    if (project.revenue_target_monthly) {
      promptParts.push(`Revenue target: £${project.revenue_target_monthly}/month`);
    }

    promptParts.push('', specBlock);

    if (activeMilestone) {
      promptParts.push('', `## Active Milestone: ${activeMilestone.name}`);
      if (activeMilestone.acceptance_criteria.length > 0) {
        promptParts.push('Acceptance Criteria (all must be met):');
        for (const ac of activeMilestone.acceptance_criteria) {
          promptParts.push(`- [ ] ${ac}`);
        }
      }
    }

    promptParts.push('', `## Task`, task);
    promptParts.push('', `## Working Instructions`);
    promptParts.push(...workingInstructions);

    const promptText = promptParts.join('\n');

    // Create job
    const { data: job, error: jobErr } = await sb
      .from('mc_jobs')
      .insert({
        title: `[${project.name}] ${task.slice(0, 100)}`,
        prompt_text: promptText,
        engine: 'claude',
        status: 'queued',
        priority: 3,
        job_type: 'task',
        source: 'dashboard',
        project_id: project.id,
        repo_path: project.repo_path,
      })
      .select('id')
      .single();

    if (jobErr) {
      return Response.json({ error: jobErr.message }, { status: 500 });
    }

    // Create notification
    await sb.from('mc_ed_notifications').insert({
      title: `Claude Code session started for ${project.name}`,
      body: task.slice(0, 200),
      category: 'job',
      priority: 'normal',
      status: 'pending',
      metadata: { project_id: project.id, job_id: job?.id, mode },
    });

    return Response.json({
      ok: true,
      mode: 'autonomous',
      job_id: job?.id,
      message: `Job queued. Scheduler will pick it up and run in ${project.repo_path}.`,
    });
  }

  // Interactive mode — spawn tmux session
  // This is less common; David would connect via remote desktop
  return Response.json({
    ok: true,
    mode: 'interactive',
    message: `Interactive mode not yet implemented. Use autonomous mode for now.`,
  });
}
