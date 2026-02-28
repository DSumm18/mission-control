import { supabaseAdmin } from '@/lib/db/supabase-server';
import {
  parseProjectSpec,
  formatSpecForPrompt,
  formatMasterIntentForPrompt,
  MasterIntentSchema,
} from './project-spec';

/**
 * Compose a full prompt for an agent executing a job.
 * Loads: agent system_prompt, job context, project delivery plan (if applicable),
 * improvement instructions from prior rejection, available skills/tools.
 */
export async function composePrompt(jobId: string, agentId: string): Promise<string> {
  const sb = supabaseAdmin();

  // Load agent
  const { data: agent } = await sb
    .from('mc_agents')
    .select('id, name, role, system_prompt')
    .eq('id', agentId)
    .single();

  // Load job
  const { data: job } = await sb
    .from('mc_jobs')
    .select('id, title, prompt_text, command, project_id, review_notes, parent_job_id')
    .eq('id', jobId)
    .single();

  if (!agent || !job) throw new Error('Agent or job not found');

  const parts: string[] = [];

  // 1. Agent system prompt
  if (agent.system_prompt) {
    parts.push(agent.system_prompt);
  }

  // 2. Job context
  parts.push('');
  parts.push('## Current Task');
  parts.push(`**Title:** ${job.title}`);
  if (job.prompt_text) {
    parts.push(`**Instructions:** ${job.prompt_text}`);
  }
  if (job.command) {
    parts.push(`**Command:** ${job.command}`);
  }

  // 3. Project specification (if applicable)
  if (job.project_id) {
    const { data: project } = await sb
      .from('mc_projects')
      .select('name, description, delivery_plan, revenue_target_monthly')
      .eq('id', job.project_id)
      .single();

    if (project) {
      parts.push('');
      parts.push('## Project Context');
      parts.push(`**Project:** ${project.name}`);
      if (project.description) parts.push(`**Description:** ${project.description}`);
      if (project.revenue_target_monthly) {
        parts.push(`**Revenue Target:** £${project.revenue_target_monthly}/month`);
      }
      if (project.delivery_plan && Object.keys(project.delivery_plan).length > 0) {
        const spec = parseProjectSpec(project.delivery_plan);
        parts.push('');
        parts.push(formatSpecForPrompt(spec, project.name));
      }
    }
  }

  // 3b. Master intent (applies to all jobs)
  try {
    const { data: intentRow } = await sb
      .from('mc_settings')
      .select('value')
      .eq('key', 'master_intent')
      .single();

    if (intentRow?.value) {
      const parsed = MasterIntentSchema.safeParse(intentRow.value);
      if (parsed.success) {
        parts.push('');
        parts.push(formatMasterIntentForPrompt(parsed.data));
      }
    }
  } catch {
    // master intent not set yet — skip
  }

  // 4. Improvement instructions from prior rejection
  if (job.review_notes) {
    parts.push('');
    parts.push('## Improvement Instructions (from prior review)');
    parts.push(job.review_notes);
    parts.push('');
    parts.push('Address the above feedback in this attempt. Improve on the areas flagged.');
  }

  // 5. Available skills/tools
  const { data: agentSkills } = await sb
    .from('mc_agent_skills')
    .select('skill_id, mc_skills(key, usage_guidelines, mcp_server_name)')
    .eq('agent_id', agentId)
    .eq('allowed', true);

  if (agentSkills && agentSkills.length > 0) {
    parts.push('');
    parts.push('## Available Tools');
    for (const as of agentSkills) {
      const skill = as.mc_skills as unknown as {
        key: string;
        usage_guidelines: string | null;
        mcp_server_name: string | null;
      };
      if (skill) {
        parts.push(`- **${skill.key}**${skill.mcp_server_name ? ` (MCP: ${skill.mcp_server_name})` : ''}: ${skill.usage_guidelines || 'No guidelines set'}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Get MCP server names for an agent based on their assigned skills.
 * Returns comma-separated string suitable for --mcp-servers flag.
 */
export async function getAgentMCPServers(agentId: string): Promise<string> {
  const sb = supabaseAdmin();

  const { data: agentSkills } = await sb
    .from('mc_agent_skills')
    .select('skill_id, mc_skills(mcp_server_name)')
    .eq('agent_id', agentId)
    .eq('allowed', true);

  if (!agentSkills || agentSkills.length === 0) return '';

  const servers = new Set<string>();
  for (const as of agentSkills) {
    const skill = as.mc_skills as unknown as { mcp_server_name: string | null };
    if (skill?.mcp_server_name) {
      servers.add(skill.mcp_server_name);
    }
  }

  return [...servers].join(',');
}
