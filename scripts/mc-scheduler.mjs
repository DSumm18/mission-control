#!/usr/bin/env node

/**
 * Mission Control Local Scheduler Daemon
 *
 * A thin poll loop that:
 *   1. Checks the pause_all flag in mc_settings
 *   2. Health-checks the local Next.js server
 *   3. Calls POST /api/jobs/run-once to claim and execute one job
 *
 * All claim, execution, and evidence logic lives in the API route.
 * This script is just a timer.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Config ──────────────────────────────────────────────────────────────

const ENV_PATH = resolve(process.cwd(), '.env.local');
const BASE_INTERVAL_MS = 30_000;       // 30 seconds
const MAX_BACKOFF_MS   = 5 * 60_000;   // 5 minutes
const SERVER_URL       = process.env.MC_SERVER_URL || 'http://localhost:3000';

// ── Load .env.local ─────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(ENV_PATH, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    log(`WARN: could not load ${ENV_PATH}: ${err.message}`);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUNNER_TOKEN = process.env.MC_RUNNER_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}
if (!RUNNER_TOKEN) {
  console.error('FATAL: MC_RUNNER_TOKEN must be set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── State ───────────────────────────────────────────────────────────────

let running = true;
let inFlight = 0;
let backoffMs = BASE_INTERVAL_MS;

// ── Helpers ─────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`${new Date().toISOString()} [scheduler] ${msg}`);
}

async function readSetting(key) {
  const { data, error } = await sb
    .from('mc_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    log(`WARN: failed to read setting ${key}: ${error.message}`);
    return null;
  }
  return data?.value ?? null;
}

async function healthCheck() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${SERVER_URL}/api/jobs`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function callRunOnce() {
  const res = await fetch(`${SERVER_URL}/api/jobs/run-once`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runner-token': RUNNER_TOKEN,
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ── Main loop ───────────────────────────────────────────────────────────

async function tick() {
  // 1. Check pause flag
  const pauseSetting = await readSetting('pause_all');
  if (pauseSetting?.enabled) {
    log('paused — pause_all flag is set');
    return;
  }

  // 2. Health-check the local server
  const healthy = await healthCheck();
  if (!healthy) {
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    log(`server unavailable at ${SERVER_URL} — backing off to ${backoffMs / 1000}s`);
    return;
  }

  // Server is back — reset backoff
  if (backoffMs !== BASE_INTERVAL_MS) {
    log(`server recovered — resetting interval to ${BASE_INTERVAL_MS / 1000}s`);
    backoffMs = BASE_INTERVAL_MS;
  }

  // 3. Check concurrency
  const concSetting = await readSetting('max_concurrency');
  const maxConcurrency = concSetting?.limit ?? 2;
  if (inFlight >= maxConcurrency) {
    log(`at concurrency limit (${inFlight}/${maxConcurrency}) — skipping`);
    return;
  }

  // 4. Check parallel_jobs setting
  const parallelSetting = await readSetting('parallel_jobs');
  const parallelJobs = parallelSetting?.count ?? 1;

  if (parallelJobs > 1) {
    // Parallel mode — call run-parallel endpoint
    inFlight++;
    try {
      const res = await fetch(`${SERVER_URL}/api/jobs/run-parallel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-runner-token': RUNNER_TOKEN,
        },
        body: JSON.stringify({ max_jobs: parallelJobs }),
      });
      const body = await res.json();

      if (body.message === 'no queued jobs') {
        log('no queued jobs');
      } else if (body.ok && body.claimed) {
        log(`parallel: ${body.claimed.length} jobs claimed`);
        for (const c of body.claimed) {
          log(`  job=${c.job_id} status=${c.status || 'claimed'} title=${c.title}`);
        }
      } else {
        log(`run-parallel response: ${JSON.stringify(body).slice(0, 500)}`);
      }
    } catch (err) {
      log(`ERROR calling run-parallel: ${err.message}`);
    } finally {
      inFlight--;
    }
  } else {
    // Single mode — call run-once
    inFlight++;
    try {
      const { status, body } = await callRunOnce();

      if (status === 401) {
        log('ERROR: run-once returned 401 — check MC_RUNNER_TOKEN');
      } else if (body.message === 'no queued jobs') {
        log('no queued jobs');
      } else if (body.ok) {
        log(`job=${body.job_id} status=${body.status}`);
      } else {
        log(`run-once response: ${JSON.stringify(body).slice(0, 500)}`);
      }
    } catch (err) {
      log(`ERROR calling run-once: ${err.message}`);
    } finally {
      inFlight--;
    }
  }
}

async function loop() {
  log(`started — polling ${SERVER_URL} every ${BASE_INTERVAL_MS / 1000}s`);

  while (running) {
    try {
      await tick();
    } catch (err) {
      log(`TICK ERROR: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, backoffMs));
  }

  log('stopped');
}

// ── Graceful shutdown ───────────────────────────────────────────────────

process.on('SIGTERM', () => { log('SIGTERM received'); running = false; });
process.on('SIGINT',  () => { log('SIGINT received');  running = false; });

loop();
