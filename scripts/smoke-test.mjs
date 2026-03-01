#!/usr/bin/env node

/**
 * Mission Control E2E Smoke Test
 *
 * Usage: npm run smoke
 *        node scripts/smoke-test.mjs
 *
 * Requires:
 *   - Next.js running on localhost:3000
 *   - Supabase accessible
 *   - .env.local with MC_RUNNER_TOKEN, SUPABASE keys
 *
 * Creates a real shell job, executes it via run-once,
 * verifies the full lifecycle, then cleans up.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Load .env.local ──────────────────────────────────────
const envPath = path.join(ROOT, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUNNER_TOKEN = process.env.MC_RUNNER_TOKEN;
const BASE_URL = process.env.MC_SERVER_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_KEY || !RUNNER_TOKEN) {
  console.error('Missing required env vars (SUPABASE_URL, SERVICE_ROLE_KEY, or MC_RUNNER_TOKEN)');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── Test runner ──────────────────────────────────────────
const results = [];
let testJobId = null;

function pad(str, len) {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

async function step(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, ok: true, ms });
    console.log(`  \x1b[32m[PASS]\x1b[0m ${pad(name, 50)} ${ms}ms`);
  } catch (err) {
    const ms = Date.now() - start;
    results.push({ name, ok: false, ms, error: err.message });
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${pad(name, 50)} ${ms}ms`);
    console.log(`         ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Pre-flight checks ────────────────────────────────────
console.log('');
console.log('  ═══════════════════════════════════════════════════');
console.log('  ║   Mission Control Smoke Test                   ║');
console.log('  ═══════════════════════════════════════════════════');
console.log('');
console.log(`  Server:   ${BASE_URL}`);
console.log(`  Supabase: ${SUPABASE_URL}`);
console.log('');

// ── Tests ────────────────────────────────────────────────

await step('Server is reachable', async () => {
  const res = await fetch(`${BASE_URL}/api/jobs`, { signal: AbortSignal.timeout(5000) });
  assert(res.ok, `Server returned ${res.status}`);
  const body = await res.json();
  assert(Array.isArray(body.jobs), 'Expected jobs array');
});

await step('Supabase is reachable', async () => {
  const { data, error } = await sb.from('mc_settings').select('key').limit(1);
  assert(!error, `Supabase error: ${error?.message}`);
  assert(data !== null, 'No data returned');
});

await step('Create test job (engine=shell)', async () => {
  const res = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '__SMOKE_TEST_' + Date.now(),
      engine: 'shell',
      repo_path: '/tmp',
      prompt_text: 'echo "MC_SMOKE_TEST_PASSED"',
      output_dir: '/tmp',
      source: 'api',
      priority: 1,
    }),
  });
  assert(res.status === 201, `Expected 201, got ${res.status}`);
  const body = await res.json();
  assert(body.job?.id, 'No job ID returned');
  assert(body.job.status === 'queued', `Expected queued, got ${body.job.status}`);
  testJobId = body.job.id;
});

await step('Job exists in database with status=queued', async () => {
  const { data } = await sb.from('mc_jobs').select('*').eq('id', testJobId).single();
  assert(data, 'Job not found in DB');
  assert(data.status === 'queued', `Expected queued, got ${data.status}`);
  assert(data.engine === 'shell', `Expected shell engine, got ${data.engine}`);
});

await step('Trigger run-once (execute job)', async () => {
  const res = await fetch(`${BASE_URL}/api/jobs/run-once`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runner-token': RUNNER_TOKEN,
    },
  });
  assert(res.ok, `run-once returned ${res.status}`);
  const body = await res.json();
  assert(body.ok, `run-once failed: ${body.error || body.message}`);
});

// Poll for completion
await step('Job completes (queued → done)', async () => {
  const deadline = Date.now() + 25_000;
  let job = null;
  while (Date.now() < deadline) {
    const { data } = await sb.from('mc_jobs').select('*').eq('id', testJobId).single();
    if (data?.status === 'done' || data?.status === 'reviewing') {
      job = data;
      break;
    }
    if (data?.status === 'failed') {
      throw new Error(`Job failed: ${data.error || data.last_error || 'unknown'}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  assert(job, 'Job did not complete within 25s');
});

await step('Result contains expected output', async () => {
  const { data } = await sb.from('mc_jobs').select('result').eq('id', testJobId).single();
  assert(data?.result, 'No result stored');
  assert(data.result.includes('MC_SMOKE_TEST_PASSED'), `Result: ${data.result.slice(0, 200)}`);
});

await step('started_at is set', async () => {
  const { data } = await sb.from('mc_jobs').select('started_at').eq('id', testJobId).single();
  assert(data?.started_at, 'started_at is null');
});

await step('completed_at is set', async () => {
  const { data } = await sb.from('mc_jobs').select('completed_at').eq('id', testJobId).single();
  assert(data?.completed_at, 'completed_at is null');
});

await step('Activity feed includes the job', async () => {
  const res = await fetch(`${BASE_URL}/api/activity?limit=50&type=job`);
  assert(res.ok, `Activity API returned ${res.status}`);
  const body = await res.json();
  const found = body.items?.find(i => i.id === `job-${testJobId}`);
  assert(found, 'Job not found in activity feed');
});

await step('Notification was created', async () => {
  const { data } = await sb
    .from('mc_ed_notifications')
    .select('id, title, category')
    .eq('source_id', testJobId)
    .limit(1);
  assert(data?.length > 0, 'No notification found for job');
});

// ── Cleanup ──────────────────────────────────────────────
await step('Cleanup test data', async () => {
  if (testJobId) {
    await sb.from('mc_ed_notifications').delete().eq('source_id', testJobId);
    await sb.from('mc_jobs').delete().eq('id', testJobId);
  }
  // Verify cleanup
  const { data } = await sb.from('mc_jobs').select('id').eq('id', testJobId).maybeSingle();
  assert(!data, 'Job still exists after cleanup');
});

// ── Summary ──────────────────────────────────────────────
console.log('');
console.log('  ───────────────────────────────────────────────────');
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
const totalMs = results.reduce((sum, r) => sum + r.ms, 0);

if (failed === 0) {
  console.log(`  \x1b[32m✓ ${passed}/${results.length} passed\x1b[0m in ${(totalMs / 1000).toFixed(1)}s`);
} else {
  console.log(`  \x1b[31m✗ ${failed} failed\x1b[0m, ${passed} passed in ${(totalMs / 1000).toFixed(1)}s`);
  console.log('');
  console.log('  Failed tests:');
  for (const r of results.filter(r => !r.ok)) {
    console.log(`    - ${r.name}: ${r.error}`);
  }
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
