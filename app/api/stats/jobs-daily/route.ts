import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: jobs, error } = await sb
    .from('mc_jobs')
    .select('status, created_at')
    .gte('created_at', sevenDaysAgo.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type DayCounts = { done: number; failed: number; reviewing: number; running: number; queued: number };
  const empty = (): DayCounts => ({ done: 0, failed: 0, reviewing: 0, running: 0, queued: 0 });

  const dayMap = new Map<string, DayCounts>();

  for (const job of jobs || []) {
    const date = job.created_at.slice(0, 10);
    if (!dayMap.has(date)) dayMap.set(date, empty());
    const bucket = dayMap.get(date)!;
    const status = job.status as keyof DayCounts;
    if (status in bucket) bucket[status] += 1;
  }

  const result: Array<{ date: string } & DayCounts> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push({ date: dateStr, ...(dayMap.get(dateStr) || empty()) });
  }

  return NextResponse.json({ daily: result });
}
