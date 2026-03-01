import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.join(__dirname, '../../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = 'http://localhost:3000';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const createdJobIds: string[] = [];

afterAll(async () => {
  for (const id of createdJobIds) {
    await sb.from('mc_jobs').delete().eq('id', id);
  }
});

describe('Activity Feed API (requires Next.js running on :3000)', () => {
  it('returns activity items', async () => {
    const res = await fetch(`${BASE_URL}/api/activity?limit=5`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('includes a newly created job in the feed', async () => {
    // Create a job directly in Supabase
    const testTitle = '__TEST_activity_' + Date.now();
    const { data: job } = await sb
      .from('mc_jobs')
      .insert({
        title: testTitle,
        engine: 'shell',
        repo_path: '/tmp',
        prompt_text: 'echo test',
        output_dir: '/tmp',
        status: 'queued',
      })
      .select('id')
      .single();
    createdJobIds.push(job!.id);

    // Fetch activity feed filtering by job type
    const res = await fetch(`${BASE_URL}/api/activity?limit=50&type=job`);
    expect(res.ok).toBe(true);
    const body = await res.json();

    // Find our test job in the feed
    const found = body.items.find((item: { title: string }) => item.title === testTitle);
    expect(found).toBeTruthy();
    expect(found.type).toBe('job');
    expect(found.status).toBe('queued');
    expect(found.statusColor).toBe('accent'); // queued = accent
  });

  it('filters by type=notification', async () => {
    const res = await fetch(`${BASE_URL}/api/activity?limit=5&type=notification`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    // All items should be notifications
    for (const item of body.items) {
      expect(item.type).toBe('notification');
    }
  });

  it('respects limit parameter', async () => {
    const res = await fetch(`${BASE_URL}/api/activity?limit=2`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.items.length).toBeLessThanOrEqual(2);
  });

  it('returns items sorted by timestamp descending', async () => {
    const res = await fetch(`${BASE_URL}/api/activity?limit=20`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    const timestamps = body.items.map((i: { timestamp: string }) => new Date(i.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });
});
