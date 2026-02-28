/**
 * Unified Activity Feed API.
 *
 * GET /api/activity?limit=20&type=job|notification|challenge|research|newsletter&project_id=X
 * Returns ActivityItem[] aggregated from multiple tables.
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

interface ActivityItem {
  id: string;
  type: 'job' | 'notification' | 'challenge' | 'research' | 'newsletter';
  title: string;
  detail: string;
  status: string;
  statusColor: 'good' | 'warn' | 'bad' | 'accent' | 'muted';
  agent?: string;
  agentEmoji?: string;
  projectId?: string;
  projectName?: string;
  timestamp: string;
  link?: string;
}

function statusColor(status: string): ActivityItem['statusColor'] {
  if (['done', 'published', 'decided', 'active', 'assessed'].includes(status)) return 'good';
  if (['reviewing', 'deliberating', 'assessing', 'captured', 'draft'].includes(status)) return 'warn';
  if (['failed', 'rejected', 'error'].includes(status)) return 'bad';
  if (['running', 'queued', 'assigned'].includes(status)) return 'accent';
  return 'muted';
}

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);
  const typeFilter = url.searchParams.get('type');
  const projectId = url.searchParams.get('project_id');

  const items: ActivityItem[] = [];

  try {
    // Jobs
    if (!typeFilter || typeFilter === 'job') {
      let q = sb
        .from('mc_jobs')
        .select('id, title, status, engine, created_at, completed_at, quality_score, mc_agents(name, avatar_emoji), mc_projects(id, name)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (projectId) q = q.eq('project_id', projectId);

      const { data: jobs } = await q;
      for (const j of jobs || []) {
        const agent = j.mc_agents as unknown as { name: string; avatar_emoji: string | null } | null;
        const project = j.mc_projects as unknown as { id: string; name: string } | null;
        items.push({
          id: `job-${j.id}`,
          type: 'job',
          title: j.title,
          detail: `${j.engine}${j.quality_score ? ` \u00B7 QA: ${j.quality_score}/50` : ''}`,
          status: j.status,
          statusColor: statusColor(j.status),
          agent: agent?.name,
          agentEmoji: agent?.avatar_emoji || undefined,
          projectId: project?.id,
          projectName: project?.name,
          timestamp: j.completed_at || j.created_at,
          link: `/jobs`,
        });
      }
    }

    // Notifications
    if (!typeFilter || typeFilter === 'notification') {
      const { data: notifs } = await sb
        .from('mc_ed_notifications')
        .select('id, title, body, category, status, priority, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const n of notifs || []) {
        items.push({
          id: `notif-${n.id}`,
          type: 'notification',
          title: n.title,
          detail: `${n.category} \u00B7 ${n.priority}`,
          status: n.status,
          statusColor: n.status === 'acknowledged' ? 'good' : n.priority === 'urgent' ? 'bad' : 'warn',
          timestamp: n.created_at,
        });
      }
    }

    // Challenge boards
    if (!typeFilter || typeFilter === 'challenge') {
      const { data: boards } = await sb
        .from('mc_challenge_board')
        .select('id, decision_title, status, final_decision, created_at, decided_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const b of boards || []) {
        items.push({
          id: `board-${b.id}`,
          type: 'challenge',
          title: b.decision_title,
          detail: b.final_decision ? `Decision: ${b.final_decision}` : `Status: ${b.status}`,
          status: b.status,
          statusColor: statusColor(b.status),
          timestamp: b.decided_at || b.created_at,
          link: `/decisions`,
        });
      }
    }

    // Research
    if (!typeFilter || typeFilter === 'research') {
      const { data: research } = await sb
        .from('mc_research_items')
        .select('id, title, status, content_type, relevance_score, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const r of research || []) {
        items.push({
          id: `research-${r.id}`,
          type: 'research',
          title: r.title || '(untitled)',
          detail: `${r.content_type}${r.relevance_score ? ` \u00B7 Score: ${r.relevance_score}/10` : ''}`,
          status: r.status,
          statusColor: statusColor(r.status),
          timestamp: r.created_at,
          link: `/research`,
        });
      }
    }

    // Newsletters
    if (!typeFilter || typeFilter === 'newsletter') {
      const { data: newsletters } = await sb
        .from('mc_newsletters')
        .select('id, week_no, title, pipeline_status, created_at, published_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const n of newsletters || []) {
        items.push({
          id: `newsletter-${n.id}`,
          type: 'newsletter',
          title: `Week ${n.week_no}: ${n.title}`,
          detail: n.pipeline_status,
          status: n.pipeline_status,
          statusColor: statusColor(n.pipeline_status),
          timestamp: n.published_at || n.created_at,
          link: `/this-week`,
        });
      }
    }

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return Response.json({ items: items.slice(0, limit) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
