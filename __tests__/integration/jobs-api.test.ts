import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env from .env.local
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

const TEST_PREFIX = '__TEST_' + Date.now() + '_';
const createdJobIds: string[] = [];

afterAll(async () => {
  // Clean up test jobs
  for (const id of createdJobIds) {
    await sb.from('mc_jobs').delete().eq('id', id);
  }
  // Clean up test notifications
  await sb.from('mc_ed_notifications').delete().ilike('title', `%${TEST_PREFIX}%`);
});

describe('Jobs API — direct Supabase', () => {
  it('creates a job with status=queued', async () => {
    const { data, error } = await sb
      .from('mc_jobs')
      .insert({
        title: `${TEST_PREFIX}create-test`,
        engine: 'shell',
        repo_path: '/tmp/test',
        prompt_text: 'echo hello',
        output_dir: '/tmp/out',
        status: 'queued',
        source: 'api',
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.status).toBe('queued');
    expect(data!.title).toBe(`${TEST_PREFIX}create-test`);
    expect(data!.engine).toBe('shell');
    createdJobIds.push(data!.id);
  });

  it('reads back the created job', async () => {
    const { data, error } = await sb
      .from('mc_jobs')
      .select('*')
      .eq('id', createdJobIds[0])
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.title).toBe(`${TEST_PREFIX}create-test`);
  });

  it('updates job status to running', async () => {
    const now = new Date().toISOString();
    const { data, error } = await sb
      .from('mc_jobs')
      .update({ status: 'running', started_at: now })
      .eq('id', createdJobIds[0])
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('running');
    expect(data!.started_at).toBeTruthy();
  });

  it('updates job status to done with result', async () => {
    const now = new Date().toISOString();
    const { data, error } = await sb
      .from('mc_jobs')
      .update({
        status: 'done',
        completed_at: now,
        result: 'hello',
      })
      .eq('id', createdJobIds[0])
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('done');
    expect(data!.completed_at).toBeTruthy();
    expect(data!.result).toBe('hello');
  });

  it('creates a notification for the job', async () => {
    const { data, error } = await sb
      .from('mc_ed_notifications')
      .insert({
        title: `${TEST_PREFIX}job-complete`,
        body: 'Test notification',
        category: 'job_complete',
        priority: 'normal',
        status: 'pending',
        source_type: 'job',
        source_id: createdJobIds[0],
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.status).toBe('pending');
  });

  it('claims a job atomically (optimistic concurrency)', async () => {
    // Create a queued job
    const { data: job } = await sb
      .from('mc_jobs')
      .insert({
        title: `${TEST_PREFIX}claim-test`,
        engine: 'shell',
        repo_path: '/tmp/test',
        prompt_text: 'echo claim',
        output_dir: '/tmp/out',
        status: 'queued',
      })
      .select('*')
      .single();
    createdJobIds.push(job!.id);

    // Claim it (simulating run-once)
    const now = new Date().toISOString();
    const { data: claimed } = await sb
      .from('mc_jobs')
      .update({ status: 'running', started_at: now })
      .eq('id', job!.id)
      .eq('status', 'queued') // Only if still queued
      .select('*')
      .maybeSingle();

    expect(claimed).toBeTruthy();
    expect(claimed!.status).toBe('running');

    // Second claim should fail (already running)
    const { data: secondClaim } = await sb
      .from('mc_jobs')
      .update({ status: 'running', started_at: now })
      .eq('id', job!.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();

    expect(secondClaim).toBeNull();
  });

  it('respects priority ordering', async () => {
    // Create two jobs: priority 5 and priority 1
    const { data: lowPri } = await sb
      .from('mc_jobs')
      .insert({
        title: `${TEST_PREFIX}priority-low`,
        engine: 'shell',
        repo_path: '/tmp',
        prompt_text: 'echo low',
        output_dir: '/tmp',
        status: 'queued',
        priority: 5,
      })
      .select('id')
      .single();
    createdJobIds.push(lowPri!.id);

    const { data: highPri } = await sb
      .from('mc_jobs')
      .insert({
        title: `${TEST_PREFIX}priority-high`,
        engine: 'shell',
        repo_path: '/tmp',
        prompt_text: 'echo high',
        output_dir: '/tmp',
        status: 'queued',
        priority: 1,
      })
      .select('id')
      .single();
    createdJobIds.push(highPri!.id);

    // Query like the scheduler does
    const { data: next } = await sb
      .from('mc_jobs')
      .select('id, title, priority')
      .eq('status', 'queued')
      .ilike('title', `${TEST_PREFIX}%`)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    expect(next).toBeTruthy();
    expect(next!.id).toBe(highPri!.id);
    expect(next!.priority).toBe(1);
  });
});
