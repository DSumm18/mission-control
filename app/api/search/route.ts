/**
 * Global Search API — parallel ilike across multiple tables.
 * GET /api/search?q=query&limit=10
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

interface SearchResult {
  id: string;
  type: 'job' | 'project' | 'agent' | 'task' | 'research' | 'newsletter';
  title: string;
  detail: string;
  href: string;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 30);

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const sb = supabaseAdmin();
  const pattern = `%${q}%`;

  try {
    const [jobs, projects, agents, tasks, research, newsletters] = await Promise.all([
      sb.from('mc_jobs').select('id, title, status, engine').ilike('title', pattern).limit(limit),
      sb.from('mc_projects').select('id, name, status').ilike('name', pattern).limit(limit),
      sb.from('mc_agents').select('id, name, role, avatar_emoji').ilike('name', pattern).limit(limit),
      sb.from('mc_tasks').select('id, title, status').ilike('title', pattern).limit(limit),
      sb.from('mc_research_items').select('id, title, status, content_type').ilike('title', pattern).limit(limit),
      sb.from('mc_newsletters').select('id, week_no, title, pipeline_status').ilike('title', pattern).limit(limit),
    ]);

    const results: SearchResult[] = [];

    for (const j of jobs.data || []) {
      results.push({
        id: j.id,
        type: 'job',
        title: j.title,
        detail: `${j.status} \u00B7 ${j.engine}`,
        href: '/jobs',
      });
    }

    for (const p of projects.data || []) {
      results.push({
        id: p.id,
        type: 'project',
        title: p.name,
        detail: p.status,
        href: `/projects/${p.id}`,
      });
    }

    for (const a of agents.data || []) {
      results.push({
        id: a.id,
        type: 'agent',
        title: `${a.avatar_emoji || ''} ${a.name}`.trim(),
        detail: a.role || 'agent',
        href: `/agents/${a.id}`,
      });
    }

    for (const t of tasks.data || []) {
      results.push({
        id: t.id,
        type: 'task',
        title: t.title,
        detail: t.status,
        href: '/tasks',
      });
    }

    for (const r of research.data || []) {
      results.push({
        id: r.id,
        type: 'research',
        title: r.title || '(untitled)',
        detail: `${r.content_type} \u00B7 ${r.status}`,
        href: `/research/${r.id}`,
      });
    }

    for (const n of newsletters.data || []) {
      results.push({
        id: n.id,
        type: 'newsletter',
        title: `Week ${n.week_no}: ${n.title}`,
        detail: n.pipeline_status,
        href: '/this-week',
      });
    }

    return Response.json({ results: results.slice(0, limit) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
