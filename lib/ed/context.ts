/**
 * Live MC state loader for Ed's context window.
 * Supports tier-based context depth — Opus gets richer context.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import type { ModelTier } from './model-router';
import { parseProjectSpec } from '@/lib/org/project-spec';

type MessageEntry = { role: 'user' | 'assistant'; content: string };

export async function buildContextBlock(tier?: ModelTier): Promise<string> {
  const sb = supabaseAdmin();
  let ctx = '\n## Current MC State\n';

  try {
    // Recent newsletters
    const { data: newsletters } = await sb
      .from('mc_newsletters')
      .select('id, week_no, title, pipeline_status')
      .order('week_no', { ascending: false })
      .limit(3);

    if (newsletters?.length) {
      ctx += '**Newsletters:**\n';
      for (const n of newsletters) {
        ctx += `- Week ${n.week_no}: "${n.title}" [${n.pipeline_status}] (id: ${n.id})\n`;
      }
    }

    // Pending research
    const { data: research } = await sb
      .from('mc_research_items')
      .select('id, title, status, relevance_score, content_type')
      .in('status', ['captured', 'assessing', 'assessed'])
      .order('created_at', { ascending: false })
      .limit(8);

    if (research?.length) {
      ctx += '\n**Pending Research:**\n';
      for (const r of research) {
        ctx += `- [${r.status}] ${r.title || '(untitled)'} (${r.content_type}, score: ${r.relevance_score || '?'}/10, id: ${r.id})\n`;
      }
    }

    // Active jobs
    const { data: jobs } = await sb
      .from('mc_jobs')
      .select('id, title, status, engine')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (jobs?.length) {
      ctx += '\n**Active Jobs:**\n';
      for (const j of jobs) {
        ctx += `- [${j.status}] ${j.title} (${j.engine})\n`;
      }
    }

    // Projects with revenue targets and milestones
    const { data: projects } = await sb
      .from('mc_projects')
      .select('id, name, status, revenue_target_monthly, delivery_plan, description')
      .eq('status', 'active')
      .order('revenue_target_monthly', { ascending: false });

    if (projects?.length) {
      const totalTarget = projects.reduce((s, p) => s + (p.revenue_target_monthly || 0), 0);
      ctx += `\n**Product Portfolio (£${totalTarget.toLocaleString()}/mo target):**\n`;
      for (const p of projects) {
        const spec = parseProjectSpec(p.delivery_plan);
        const nextMs = spec.milestones.find(m => m.status !== 'done');
        const msInfo = nextMs ? ` → next: ${nextMs.name} [${nextMs.status}]${nextMs.target ? ` by ${nextMs.target}` : ''}` : '';
        ctx += `- **${p.name}** — £${p.revenue_target_monthly || 0}/mo target${msInfo} (id: ${p.id})\n`;
        if (p.description) ctx += `  ${p.description}\n`;

        // Show key blockers for all tiers
        if (spec.key_blockers.length > 0) {
          ctx += `  Blockers: ${spec.key_blockers.join('; ')}\n`;
        }

        // Opus tier: include expanded spec details
        if (tier === 'opus') {
          if (spec.current_status) ctx += `  Status: ${spec.current_status}\n`;
          if (spec.milestones.length > 0) {
            ctx += `  Milestones:\n`;
            for (const m of spec.milestones) {
              ctx += `    - ${m.name} [${m.status}]${m.target ? ` (target: ${m.target})` : ''}\n`;
              if (m.acceptance_criteria.length > 0) {
                ctx += `      Criteria: ${m.acceptance_criteria.join('; ')}\n`;
              }
            }
          }
        }
      }
    }

    // Agent summary
    const { data: agents } = await sb
      .from('mc_agents')
      .select('name, active, consecutive_failures')
      .order('name');

    if (agents?.length) {
      const activeCount = agents.filter(a => a.active).length;
      ctx += `\n**Agents:** ${activeCount}/${agents.length} active\n`;
    }

    // Env health summary
    const { data: envHealth } = await sb
      .from('mc_env_health')
      .select('project_id, health_score, missing_vercel, missing_local')
      .lt('health_score', 100);

    if (envHealth?.length) {
      const { data: projects } = await sb
        .from('mc_projects')
        .select('id, name')
        .in('id', envHealth.map(e => e.project_id));
      const nameMap = new Map((projects || []).map(p => [p.id, p.name]));
      const unhealthy = envHealth.filter(e => e.health_score < 80);
      if (unhealthy.length > 0) {
        ctx += '\n**Env Health Issues:**\n';
        for (const e of unhealthy) {
          const name = nameMap.get(e.project_id) || 'Unknown';
          const missing = [...(e.missing_vercel || []), ...(e.missing_local || [])];
          ctx += `- ${name}: score ${e.health_score}/100 — missing: ${missing.slice(0, 5).join(', ') || 'none'}\n`;
        }
      }
    }

    // Recent tasks
    const { data: tasks } = await sb
      .from('mc_tasks')
      .select('id, title, status, priority')
      .in('status', ['todo', 'in_progress'])
      .order('priority', { ascending: true })
      .limit(5);

    if (tasks?.length) {
      ctx += '\n**Open Tasks:**\n';
      for (const t of tasks) {
        ctx += `- [${t.status}] ${t.title} (priority: ${t.priority})\n`;
      }
    }

    // Challenge boards (open + deliberating)
    const { data: boards } = await sb
      .from('mc_challenge_board')
      .select('id, decision_title, status, options, created_at')
      .in('status', ['open', 'deliberating'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (boards?.length) {
      ctx += '\n**Open Challenge Boards:**\n';
      for (const b of boards) {
        const opts = b.options as { label: string; summary: string; recommended_by?: string[] }[];
        const optSummary = opts.map(o => `${o.label}: ${o.summary}`).join(', ');
        ctx += `- [${b.status}] "${b.decision_title}" — Options: ${optSummary} (id: ${b.id})\n`;
      }
    }

    // Tasks assigned to David (decisions/sign-offs)
    const { data: davidTasks } = await sb
      .from('mc_tasks')
      .select('id, title, status, task_type, priority')
      .eq('assigned_to', 'david')
      .in('status', ['todo', 'in_progress'])
      .order('priority', { ascending: true })
      .limit(5);

    if (davidTasks?.length) {
      ctx += '\n**David\'s Pending Decisions:**\n';
      for (const t of davidTasks) {
        ctx += `- [${t.task_type || 'decision'}] ${t.title} (priority: ${t.priority}, id: ${t.id})\n`;
      }
    }

    // Pending notifications
    const { data: notifications } = await sb
      .from('mc_ed_notifications')
      .select('id, title, body, category, priority, created_at')
      .in('status', ['pending', 'delivered'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (notifications?.length) {
      ctx += '\n**Pending Items for David:**\n';
      for (const n of notifications) {
        ctx += `- [${n.priority}] ${n.title}${n.body ? ` — ${n.body.slice(0, 100)}` : ''} (${n.category}, id: ${n.id})\n`;
      }
    }

    // Recent decisions for pattern learning + quality analysis
    const { data: recentDecisions } = await sb
      .from('mc_challenge_board')
      .select('decision_title, final_decision, rationale, decided_at, options')
      .eq('status', 'decided')
      .order('decided_at', { ascending: false })
      .limit(tier === 'opus' ? 10 : 5);

    if (recentDecisions?.length) {
      ctx += '\n**Recent Decisions (for learning):**\n';
      for (const d of recentDecisions) {
        ctx += `- "${d.decision_title}" → ${d.final_decision}${d.rationale ? ` (${d.rationale})` : ''}\n`;
      }
    }

    // Decision quality metrics for Ed's self-assessment
    const { data: allDecided } = await sb
      .from('mc_challenge_board')
      .select('id')
      .eq('status', 'decided');

    const { data: allResponses } = await sb
      .from('mc_challenge_responses')
      .select('board_id, agent_id, perspective, position');

    if (allDecided && allDecided.length >= 2 && allResponses) {
      const decidedIds = new Set(allDecided.map(d => d.id));
      const decidedResponses = allResponses.filter(r => decidedIds.has(r.board_id));
      const avgResponses = decidedResponses.length / allDecided.length;
      const perspectives = new Set(decidedResponses.map(r => r.perspective));
      const uniqueAgents = new Set(decidedResponses.map(r => r.agent_id));
      // Check if positions are unanimous (lack of healthy debate)
      const byBoard = new Map<string, string[]>();
      for (const r of decidedResponses) {
        if (r.position) {
          const list = byBoard.get(r.board_id) || [];
          list.push(r.position);
          byBoard.set(r.board_id, list);
        }
      }
      const unanimousCount = [...byBoard.values()].filter(positions => new Set(positions).size === 1).length;

      ctx += '\n**Decision Board Health:**\n';
      ctx += `- ${allDecided.length} decisions made, avg ${avgResponses.toFixed(1)} responses/board\n`;
      ctx += `- ${uniqueAgents.size} unique challengers, ${perspectives.size} perspective types used\n`;
      if (unanimousCount > allDecided.length * 0.5) {
        ctx += `- WARNING: ${unanimousCount}/${allDecided.length} boards had unanimous positions — challenge board may need more diverse perspectives or stronger dissent\n`;
      }
      if (avgResponses < 3) {
        ctx += `- WARNING: Low response rate — consider involving more executives per decision\n`;
      }
    }

    // Skill gap analysis — which agents lack tools for their role
    const { data: agentSkills } = await sb
      .from('mc_agents')
      .select('id, name, role, department, status')
      .eq('status', 'active')
      .order('name');

    if (agentSkills?.length) {
      const { data: skillAssignments } = await sb
        .from('mc_agent_skills')
        .select('agent_id, mc_skills(key, status)')
        .in('agent_id', agentSkills.map(a => a.id));

      const agentToolMap = new Map<string, string[]>();
      for (const sa of skillAssignments || []) {
        const skill = sa.mc_skills as unknown as { key: string; status: string } | null;
        if (!skill || skill.status === 'disabled') continue;
        const list = agentToolMap.get(sa.agent_id) || [];
        list.push(skill.key);
        agentToolMap.set(sa.agent_id, list);
      }

      const noTools = agentSkills.filter(a => !agentToolMap.has(a.id));
      const fewTools = agentSkills.filter(a => {
        const count = agentToolMap.get(a.id)?.length || 0;
        return count > 0 && count <= 1;
      });

      if (noTools.length > 0 || fewTools.length > 0) {
        ctx += '\n**Skill Gaps (agents needing tools):**\n';
        for (const a of noTools) {
          ctx += `- ${a.name} (${a.role || a.department}) — NO tools assigned\n`;
        }
        for (const a of fewTools) {
          const tools = agentToolMap.get(a.id) || [];
          ctx += `- ${a.name} (${a.role || a.department}) — only ${tools.length} tool: ${tools.join(', ')}\n`;
        }
      }
    }

    // Opus tier: extended context — recent completed job results + cost summary
    if (tier === 'opus') {
      const { data: recentJobs } = await sb
        .from('mc_jobs')
        .select('title, status, result, quality_score, completed_at, engine')
        .eq('status', 'done')
        .order('completed_at', { ascending: false })
        .limit(5);

      if (recentJobs?.length) {
        ctx += '\n**Recent Completed Jobs (for strategic context):**\n';
        for (const j of recentJobs) {
          const result = typeof j.result === 'string' ? j.result.slice(0, 500) : JSON.stringify(j.result || '').slice(0, 500);
          ctx += `- ${j.title} [${j.engine}] QA:${j.quality_score || '?'}/50\n  ${result}\n`;
        }
      }

      // Cost summary for Opus
      const { data: costData } = await sb
        .from('mc_runs')
        .select('engine, cost_usd')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

      if (costData?.length) {
        const totalCost = costData.reduce((s, r) => s + (r.cost_usd || 0), 0);
        const byEngine = new Map<string, number>();
        for (const r of costData) {
          byEngine.set(r.engine, (byEngine.get(r.engine) || 0) + (r.cost_usd || 0));
        }
        ctx += `\n**Cost Summary (7d): $${totalCost.toFixed(4)} total**\n`;
        for (const [engine, cost] of byEngine) {
          ctx += `- ${engine}: $${cost.toFixed(4)} (${costData.filter(r => r.engine === engine).length} runs)\n`;
        }
      }
    }

    // Today's date for deadline awareness
    ctx += `\n**Today:** ${new Date().toISOString().split('T')[0]}\n`;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    ctx += `(Error loading state: ${message})\n`;
  }

  return ctx;
}

/**
 * Load recent conversation history as messages[] array.
 * Returns proper multi-turn format for CLI prompt building.
 */
export async function loadConversationHistory(
  conversationId: string,
  limit = 20,
): Promise<MessageEntry[]> {
  const sb = supabaseAdmin();

  const { data } = await sb
    .from('mc_ed_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data?.length) return [];

  // Reverse to chronological order and map to message format
  const messages: MessageEntry[] = [];
  for (const m of data.reverse()) {
    const role = m.role === 'user' ? 'user' as const : 'assistant' as const;
    // Merge consecutive same-role messages
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      const last = messages[messages.length - 1];
      last.content = `${last.content}\n${m.content}`;
    } else {
      messages.push({ role, content: m.content });
    }
  }

  // Ensure messages start with user
  if (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }

  return messages;
}
