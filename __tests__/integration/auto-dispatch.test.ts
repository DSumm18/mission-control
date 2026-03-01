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

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const createdJobIds: string[] = [];
const createdNotifIds: string[] = [];

afterAll(async () => {
  for (const id of createdJobIds) {
    await sb.from('mc_jobs').delete().eq('id', id);
  }
  for (const id of createdNotifIds) {
    await sb.from('mc_ed_notifications').delete().eq('id', id);
  }
});

describe('Auto-dispatch integration (Supabase direct)', () => {
  it('can create a failed job with retry_count=0', async () => {
    const { data: job, error } = await sb
      .from('mc_jobs')
      .insert({
        title: '__TEST_autodispatch_' + Date.now(),
        engine: 'shell',
        repo_path: '/tmp',
        prompt_text: 'echo fail',
        output_dir: '/tmp',
        status: 'failed',
        retry_count: 0,
        error: 'test error',
        last_error: 'test error',
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(job).toBeTruthy();
    expect(job!.status).toBe('failed');
    expect(job!.retry_count).toBe(0);
    createdJobIds.push(job!.id);
  });

  it('can simulate auto-retry by requeuing a failed job', async () => {
    const jobId = createdJobIds[0];

    // Simulate what auto-dispatch does
    const { data, error } = await sb
      .from('mc_jobs')
      .update({
        status: 'queued',
        retry_count: 1,
        started_at: null,
        completed_at: null,
        result: null,
        last_error: null, // BUG FIX: should clear last_error
      })
      .eq('id', jobId)
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('queued');
    expect(data!.retry_count).toBe(1);
    expect(data!.last_error).toBeNull();
    expect(data!.started_at).toBeNull();
    expect(data!.completed_at).toBeNull();
  });

  it('can create a stall alert notification', async () => {
    const jobId = createdJobIds[0];

    const { data: notif, error } = await sb
      .from('mc_ed_notifications')
      .insert({
        title: `Stalled job: __TEST_stall`,
        body: 'Running for 15 minutes. May need investigation.',
        category: 'alert',
        priority: 'high',
        status: 'pending',
        metadata: { job_id: jobId, type: 'stalled_job' },
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(notif).toBeTruthy();
    expect(notif!.category).toBe('alert');
    expect(notif!.priority).toBe('high');
    createdNotifIds.push(notif!.id);
  });

  it('can check for existing stall notification (dedup)', async () => {
    const jobId = createdJobIds[0];

    const { data: existing } = await sb
      .from('mc_ed_notifications')
      .select('id')
      .eq('metadata->>job_id', jobId)
      .eq('category', 'alert')
      .in('status', ['pending', 'delivered'])
      .limit(1);

    expect(existing).toBeTruthy();
    expect(existing!.length).toBeGreaterThan(0);
  });

  it('settings table has pause_all key', async () => {
    const { data, error } = await sb
      .from('mc_settings')
      .select('key, value')
      .eq('key', 'pause_all')
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    // Value might be a proper object or a stringified value depending on how it was set
    expect(data!.key).toBe('pause_all');
    expect(data!.value).toBeDefined();
  });

  it('settings table has max_concurrency key', async () => {
    const { data, error } = await sb
      .from('mc_settings')
      .select('key, value')
      .eq('key', 'max_concurrency')
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.value).toHaveProperty('limit');
  });
});
