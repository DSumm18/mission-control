#!/usr/bin/env node
/**
 * Ed Heartbeat — calls POST /api/ed/heartbeat
 * Invoked by launchd at 08:00 and 18:00 daily.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const MC_DIR = resolve(import.meta.dirname, '..');
const envPath = resolve(MC_DIR, '.env.local');

// Load MC_RUNNER_TOKEN from .env.local
let runnerToken = process.env.MC_RUNNER_TOKEN;
if (!runnerToken) {
  try {
    const envFile = readFileSync(envPath, 'utf-8');
    const match = envFile.match(/^MC_RUNNER_TOKEN=(.+)$/m);
    if (match) runnerToken = match[1].trim();
  } catch {
    // ignore
  }
}

if (!runnerToken) {
  console.error('[ed-heartbeat] MC_RUNNER_TOKEN not found');
  process.exit(1);
}

const hour = new Date().getHours();
const type = hour < 12 ? 'morning' : 'evening';

const BASE_URL = process.env.MC_BASE_URL || 'http://localhost:3000';

console.log(`[ed-heartbeat] Sending ${type} briefing to ${BASE_URL}...`);

try {
  const res = await fetch(`${BASE_URL}/api/ed/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runner-token': runnerToken,
    },
    body: JSON.stringify({ type }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log(`[ed-heartbeat] Briefing sent. Telegram: ${data.telegram_sent}`);
    console.log(data.briefing);
  } else {
    console.error(`[ed-heartbeat] Error: ${data.error}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`[ed-heartbeat] Fetch error: ${err.message}`);
  process.exit(1);
}
