/**
 * Detailed Cost API.
 * GET /api/costs/detailed?period=7d|30d|90d&group_by=engine|agent|project
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const period = url.searchParams.get('period') || '7d';
  const groupBy = url.searchParams.get('group_by') || 'engine';

  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  try {
    const { data: runs } = await sb
      .from('mc_runs')
      .select('engine, cost_usd, duration_ms, created_at, mc_jobs(title, mc_agents(name), mc_projects(name))')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (!runs?.length) {
      return Response.json({
        total_cost: 0,
        total_runs: 0,
        groups: [],
        daily: [],
      });
    }

    const totalCost = runs.reduce((s, r) => s + (r.cost_usd || 0), 0);

    // Group by requested dimension
    const groups = new Map<string, { runs: number; cost: number; avg_duration: number }>();
    for (const r of runs) {
      let key = r.engine || 'unknown';
      if (groupBy === 'agent') {
        const job = r.mc_jobs as unknown as { mc_agents?: { name: string } } | null;
        key = job?.mc_agents?.name || 'unassigned';
      } else if (groupBy === 'project') {
        const job = r.mc_jobs as unknown as { mc_projects?: { name: string } } | null;
        key = job?.mc_projects?.name || 'unassigned';
      }

      const g = groups.get(key) || { runs: 0, cost: 0, avg_duration: 0 };
      g.runs += 1;
      g.cost += r.cost_usd || 0;
      g.avg_duration += r.duration_ms || 0;
      groups.set(key, g);
    }

    const groupArr = [...groups.entries()]
      .map(([name, g]) => ({
        name,
        runs: g.runs,
        cost: Math.round(g.cost * 10000) / 10000,
        avg_duration_ms: Math.round(g.avg_duration / g.runs),
      }))
      .sort((a, b) => b.cost - a.cost);

    // Daily breakdown
    const dailyMap = new Map<string, number>();
    for (const r of runs) {
      const date = r.created_at.split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + (r.cost_usd || 0));
    }

    const daily = [...dailyMap.entries()]
      .map(([date, cost]) => ({ date, cost: Math.round(cost * 10000) / 10000 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return Response.json({
      total_cost: Math.round(totalCost * 10000) / 10000,
      total_runs: runs.length,
      period,
      groups: groupArr,
      daily,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
