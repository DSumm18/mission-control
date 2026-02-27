/**
 * MC_ACTION parser + executor.
 * Lifted from ed-telegram.mjs:262-441, extended with spawn_job and check_status.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import type { EdAction, EdActionResult } from './types';
import { createChallengeBoard, recordDecision } from './challenge-board';

/**
 * Parse MC_ACTION blocks from Ed's response text.
 * Returns { cleanText, actions }.
 */
export function parseActions(text: string): {
  cleanText: string;
  actions: EdAction[];
} {
  const actionRegex = /\[MC_ACTION:(\w+)\](.*?)\[\/MC_ACTION\]/gs;
  const actions: EdAction[] = [];
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      actions.push({
        type: match[1],
        params: JSON.parse(match[2]),
      });
    } catch {
      // Invalid JSON — skip
    }
  }

  const cleanText = text
    .replace(actionRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, actions };
}

/**
 * Execute an array of MC actions and return results.
 */
export async function executeActions(actions: EdAction[]): Promise<EdActionResult[]> {
  const sb = supabaseAdmin();
  const results: EdActionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_research': {
          const p = action.params as Record<string, string>;
          const { data, error } = await sb
            .from('mc_research_items')
            .upsert(
              {
                source_url: p.url,
                title: p.title || null,
                content_type: p.content_type || 'article',
                shared_by: 'david',
                status: 'captured',
                why_relevant: p.notes || null,
              },
              { onConflict: 'source_url' },
            )
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'create_research', id: data.id, ok: true });
          break;
        }

        case 'queue_scout': {
          const p = action.params as Record<string, string>;
          const { data: scout } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Scout')
            .single();

          let researchId = p.research_item_id;
          if (!researchId && p.url) {
            const { data: ri } = await sb
              .from('mc_research_items')
              .select('id')
              .eq('source_url', p.url)
              .single();
            researchId = ri?.id;
          }

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Assess: ${p.title || p.url || 'Research item'}`,
              prompt_text: `Assess this content for the Schoolgle Signal newsletter. URL: ${p.url || 'N/A'}. Content type: ${p.content_type || 'article'}. Summarise the key points, score relevance 1-10 for UK school leaders, suggest a newsletter angle, and explain WHY it matters.`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: scout?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;

          if (researchId) {
            await sb
              .from('mc_research_items')
              .update({ assessment_job_id: job.id, status: 'assessing' })
              .eq('id', researchId);
          }

          results.push({ type: 'queue_scout', job_id: job.id, ok: true });
          break;
        }

        case 'queue_hawk': {
          const p = action.params as Record<string, string>;
          const { data: hawk } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Hawk')
            .single();

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Deep Dive: ${p.focus || 'Analysis'}`,
              prompt_text: `Deep analysis for Schoolgle Signal: ${p.focus || 'General analysis'}. Provide policy context, cross-references with DfE data, implications for UK school leaders, and actionable recommendations.${p.research_item_id ? ` Research item: ${p.research_item_id}` : ''}`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: hawk?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'queue_hawk', job_id: job.id, ok: true });
          break;
        }

        case 'create_task': {
          const p = action.params as Record<string, string | number>;
          const { data: task, error } = await sb
            .from('mc_tasks')
            .insert({
              title: p.title,
              description: p.description || '',
              status: 'todo',
              priority: p.priority || 5,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'create_task', task_id: task.id, ok: true });
          break;
        }

        case 'queue_draft': {
          const p = action.params as Record<string, string>;
          const { data: ed } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Ed')
            .single();

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Generate Draft: Newsletter ${p.newsletter_id}`,
              prompt_text: `Decompose newsletter ${p.newsletter_id} into sections. Review approved research items and generate a draft plan.`,
              repo_path: '/Users/david/.openclaw/workspace/mission-control',
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: ed?.id || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'queue_draft', job_id: job.id, ok: true });
          break;
        }

        case 'spawn_job': {
          const p = action.params as Record<string, string>;
          let agentId: string | null = null;
          if (p.agent_name) {
            const { data: agent } = await sb
              .from('mc_agents')
              .select('id')
              .eq('name', p.agent_name)
              .single();
            agentId = agent?.id || null;
          }

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: p.title || 'Ed-spawned job',
              prompt_text: p.prompt_text || '',
              repo_path: p.repo_path || '/Users/david/.openclaw/workspace/mission-control',
              engine: p.engine || 'claude',
              status: 'queued',
              priority: Number(p.priority) || 3,
              agent_id: agentId,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'spawn_job', job_id: job.id, ok: true });
          break;
        }

        case 'review_project': {
          const p = action.params as Record<string, string>;
          // Look up the project
          const { data: project } = await sb
            .from('mc_projects')
            .select('id, name, repo_path')
            .or(`id.eq.${p.project_id || '00000000-0000-0000-0000-000000000000'},name.ilike.%${p.project_name || ''}%`)
            .limit(1)
            .single();

          if (!project) {
            results.push({ type: 'review_project', ok: false, error: `Project not found: ${p.project_name || p.project_id}` });
            break;
          }

          const repoPath = project.repo_path || p.repo_path;
          if (!repoPath) {
            results.push({ type: 'review_project', ok: false, error: `No repo_path set for ${project.name}. Ask David for the repo location.` });
            break;
          }

          // Find Inspector agent for code review
          const { data: inspector } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Inspector')
            .single();

          const { data: job, error } = await sb
            .from('mc_jobs')
            .insert({
              title: `Project Review: ${project.name}`,
              prompt_text: `Review the codebase at ${repoPath} for the ${project.name} project. Produce a status report covering:
1. What exists (files, features, infrastructure)
2. What's working vs incomplete
3. Tech stack and architecture
4. What's needed to reach MVP / first revenue
5. Estimated effort for each remaining item
6. Blockers or decisions needed from David
Output a structured JSON report with these sections.`,
              repo_path: repoPath,
              engine: 'claude',
              status: 'queued',
              priority: 1,
              agent_id: inspector?.id || null,
              project_id: project.id,
            })
            .select('id')
            .single();
          if (error) throw error;
          results.push({ type: 'review_project', job_id: job.id, id: project.id, ok: true });
          break;
        }

        case 'plan_project': {
          const p = action.params as Record<string, string | { title: string; description?: string; assigned_to?: string; task_type?: string; priority?: number }[]>;
          // Look up the project
          const { data: project } = await sb
            .from('mc_projects')
            .select('id, name')
            .or(`id.eq.${(p.project_id as string) || '00000000-0000-0000-0000-000000000000'},name.ilike.%${(p.project_name as string) || ''}%`)
            .limit(1)
            .single();

          if (!project) {
            results.push({ type: 'plan_project', ok: false, error: `Project not found` });
            break;
          }

          // Create tasks from the plan
          const tasks = p.tasks as { title: string; description?: string; assigned_to?: string; task_type?: string; priority?: number }[];
          if (!Array.isArray(tasks) || tasks.length === 0) {
            results.push({ type: 'plan_project', ok: false, error: 'No tasks provided in plan' });
            break;
          }

          let created = 0;
          for (const t of tasks) {
            const { error: taskErr } = await sb
              .from('mc_tasks')
              .insert({
                title: t.title,
                description: t.description || '',
                project_id: project.id,
                status: 'todo',
                priority: t.priority || 5,
                assigned_to: t.assigned_to || 'unassigned',
                task_type: t.task_type || 'action',
              });
            if (!taskErr) created++;
          }

          results.push({ type: 'plan_project', id: project.id, ok: true });
          break;
        }

        case 'update_project': {
          const p = action.params as Record<string, string>;
          const updates: Record<string, unknown> = {};
          if (p.repo_path) updates.repo_path = p.repo_path;
          if (p.description) updates.description = p.description;
          if (p.delivery_plan) updates.delivery_plan = JSON.parse(p.delivery_plan);

          if (Object.keys(updates).length === 0) {
            results.push({ type: 'update_project', ok: false, error: 'No fields to update' });
            break;
          }

          const { error } = await sb
            .from('mc_projects')
            .update(updates)
            .or(`id.eq.${p.project_id || '00000000-0000-0000-0000-000000000000'},name.ilike.%${p.project_name || ''}%`);
          if (error) throw error;
          results.push({ type: 'update_project', ok: true });
          break;
        }

        case 'challenge_board': {
          const p = action.params as Record<string, unknown>;
          const challengers = (p.challengers as string[]) || ['Kate', 'Kerry', 'Nic', 'Helen'];
          const options = (p.options as string[]) || [];

          // Find project if mentioned
          let projectId: string | undefined;
          if (p.project_name) {
            const { data: proj } = await sb
              .from('mc_projects')
              .select('id')
              .ilike('name', `%${p.project_name as string}%`)
              .limit(1)
              .single();
            projectId = proj?.id;
          }

          const result = await createChallengeBoard({
            title: (p.title as string) || 'Untitled Decision',
            context: (p.context as string) || '',
            options,
            challengers,
            projectId,
          });

          results.push({
            type: 'challenge_board',
            id: result.board_id,
            ok: true,
          });
          break;
        }

        case 'approve_task': {
          const p = action.params as Record<string, string>;
          // Find the task by title match or ID
          let taskQuery = sb.from('mc_tasks').select('id, title');
          if (p.task_id) {
            taskQuery = taskQuery.eq('id', p.task_id);
          } else if (p.title) {
            taskQuery = taskQuery.ilike('title', `%${p.title}%`);
          }
          const { data: task } = await taskQuery.limit(1).single();

          if (!task) {
            results.push({ type: 'approve_task', ok: false, error: `Task not found: ${p.title || p.task_id}` });
            break;
          }

          const { error } = await sb
            .from('mc_tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', task.id);
          if (error) throw error;
          results.push({ type: 'approve_task', task_id: task.id, ok: true });
          break;
        }

        case 'decide': {
          const p = action.params as Record<string, string>;
          // Find open challenge board
          let boardQuery = sb.from('mc_challenge_board').select('id, decision_title');
          if (p.board_id) {
            boardQuery = boardQuery.eq('id', p.board_id);
          } else if (p.title) {
            boardQuery = boardQuery.ilike('decision_title', `%${p.title}%`);
          }
          boardQuery = boardQuery.in('status', ['open', 'deliberating']);
          const { data: board } = await boardQuery.limit(1).single();

          if (!board) {
            results.push({ type: 'decide', ok: false, error: `No open board found: ${p.title || p.board_id}` });
            break;
          }

          await recordDecision(board.id, p.decision || p.option || '', p.rationale || '');
          results.push({ type: 'decide', id: board.id, ok: true });
          break;
        }

        case 'update_task': {
          const p = action.params as Record<string, string>;
          let taskQuery = sb.from('mc_tasks').select('id');
          if (p.task_id) {
            taskQuery = taskQuery.eq('id', p.task_id);
          } else if (p.title) {
            taskQuery = taskQuery.ilike('title', `%${p.title}%`);
          }
          const { data: task } = await taskQuery.limit(1).single();

          if (!task) {
            results.push({ type: 'update_task', ok: false, error: `Task not found: ${p.title || p.task_id}` });
            break;
          }

          const updates: Record<string, unknown> = {};
          if (p.status) updates.status = p.status;
          if (p.notes) updates.description = p.notes;
          if (p.assigned_to) updates.assigned_to = p.assigned_to;
          if (p.priority) updates.priority = Number(p.priority);
          if (p.status === 'done') updates.completed_at = new Date().toISOString();

          const { error } = await sb.from('mc_tasks').update(updates).eq('id', task.id);
          if (error) throw error;
          results.push({ type: 'update_task', task_id: task.id, ok: true });
          break;
        }

        case 'request_tools': {
          const p = action.params as Record<string, string | string[]>;
          // Log the request — tools are managed via mc_agent_skills
          const agentName = p.agent_name as string;
          const tools = p.tools as string[];

          if (!agentName || !tools?.length) {
            results.push({ type: 'request_tools', ok: false, error: 'Need agent_name and tools[]' });
            break;
          }

          const { data: agent } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', agentName)
            .single();

          if (!agent) {
            results.push({ type: 'request_tools', ok: false, error: `Agent not found: ${agentName}` });
            break;
          }

          let assigned = 0;
          for (const toolKey of tools) {
            const { data: skill } = await sb
              .from('mc_skills')
              .select('id')
              .eq('key', toolKey)
              .single();

            if (skill) {
              await sb
                .from('mc_agent_skills')
                .upsert(
                  { agent_id: agent.id, skill_id: skill.id, allowed: true },
                  { onConflict: 'agent_id,skill_id' },
                );
              assigned++;
            }
          }
          results.push({ type: 'request_tools', ok: true });
          break;
        }

        case 'check_status': {
          // This is a read-only action — Ed uses the context block
          results.push({ type: 'check_status', ok: true });
          break;
        }

        default:
          results.push({ type: action.type, ok: false, error: `Unknown action: ${action.type}` });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ type: action.type, ok: false, error: message });
    }
  }

  return results;
}
