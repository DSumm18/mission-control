/**
 * Parallel Job Execution — claims and runs up to N jobs concurrently.
 *
 * POST /api/jobs/run-parallel
 * Headers: x-runner-token: MC_RUNNER_TOKEN
 * Body: { max_jobs?: number } (default: 3)
 *
 * Claims up to max_jobs queued jobs and fires POST /api/jobs/run-once for each.
 * Returns immediately with claimed job IDs.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function POST(req: NextRequest) {
  const expected = process.env.MC_RUNNER_TOKEN;
  const got = req.headers.get('x-runner-token') || '';

  if (!expected || got !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { max_jobs?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const maxJobs = Math.min(body.max_jobs || 3, 5); // Cap at 5

  const sb = supabaseAdmin();

  // Get queued jobs
  const { data: queued, error } = await sb
    .from('mc_jobs')
    .select('id, title, priority')
    .eq('status', 'queued')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(maxJobs);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!queued?.length) {
    return Response.json({ ok: true, message: 'no queued jobs', claimed: [] });
  }

  // Fire run-once for each job concurrently
  const baseUrl = process.env.MC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const results = await Promise.allSettled(
    queued.map(async (job) => {
      const res = await fetch(`${baseUrl}/api/jobs/run-once`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-runner-token': expected,
        },
      });
      const data = await res.json();
      return { job_id: job.id, title: job.title, ok: data.ok, status: data.status };
    }),
  );

  const claimed = results.map((r, i) => {
    const base = { job_id: queued[i].id, title: queued[i].title };
    if (r.status === 'fulfilled') {
      return { ...base, ok: r.value.ok, status: r.value.status };
    }
    return { ...base, ok: false, error: (r.reason as Error).message };
  });

  return Response.json({ ok: true, claimed });
}
