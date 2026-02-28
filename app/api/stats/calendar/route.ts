/**
 * Calendar API — jobs grouped by day for calendar view.
 * GET /api/stats/calendar?weeks=4
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

interface DayStats {
  date: string;
  total: number;
  done: number;
  failed: number;
  running: number;
  jobs: { id: string; title: string; status: string; engine: string }[];
}

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const weeks = Math.min(parseInt(url.searchParams.get('weeks') || '4'), 12);
  const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString();

  try {
    const { data: jobs } = await sb
      .from('mc_jobs')
      .select('id, title, status, engine, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    // Group by date
    const byDate = new Map<string, DayStats>();
    for (const j of jobs || []) {
      const date = j.created_at.split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, { date, total: 0, done: 0, failed: 0, running: 0, jobs: [] });
      }
      const d = byDate.get(date)!;
      d.total += 1;
      if (j.status === 'done') d.done += 1;
      else if (j.status === 'failed') d.failed += 1;
      else if (['running', 'queued', 'assigned'].includes(j.status)) d.running += 1;
      d.jobs.push({ id: j.id, title: j.title, status: j.status, engine: j.engine });
    }

    // Fill empty dates
    const days: DayStats[] = [];
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      days.push(byDate.get(dateStr) || { date: dateStr, total: 0, done: 0, failed: 0, running: 0, jobs: [] });
    }

    return Response.json({ days });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
