import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

export const runtime = 'nodejs';

const LOG_PATH = path.join(process.cwd(), 'logs', 'jobs-runner.log');

async function appendRunnerLog(line: string) {
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.appendFile(LOG_PATH, `${new Date().toISOString()} ${line}\n`, 'utf8');
}

function runProcess(cmd: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 30 }));
    child.on('error', (err) => resolve({ stdout, stderr: `${stderr}\n${err.message}`, code: 30 }));
  });
}

export async function POST(req: NextRequest) {
  const expected = process.env.MC_RUNNER_TOKEN;
  const got = req.headers.get('x-runner-token') || '';

  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = supabaseAdmin();

  const { data: queued, error: qErr } = await sb
    .from('mc_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (qErr) {
    await appendRunnerLog(`queue-read-error ${qErr.message}`);
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  if (!queued) {
    await appendRunnerLog('no-queued-jobs');
    return NextResponse.json({ ok: true, message: 'no queued jobs' });
  }

  const claimTs = new Date().toISOString();
  const { data: claimed, error: cErr } = await sb
    .from('mc_jobs')
    .update({ status: 'running', started_at: claimTs, last_error: null })
    .eq('id', queued.id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle();

  if (cErr || !claimed) {
    await appendRunnerLog(`claim-failed job=${queued.id} err=${cErr?.message || 'already claimed'}`);
    return NextResponse.json({ ok: false, message: 'claim failed' }, { status: 409 });
  }

  const runner = path.join(process.cwd(), 'scripts', 'ag_run.sh');
  const args = [
    '--job-id', claimed.id,
    '--engine', claimed.engine,
    '--repo', claimed.repo_path,
    '--command', claimed.command || claimed.prompt_text,
    '--args', JSON.stringify(claimed.args || []),
  ];

  await appendRunnerLog(`run-start job=${claimed.id} engine=${claimed.engine} repo=${claimed.repo_path}`);

  const proc = await runProcess(runner, args);
  const raw = proc.stdout.trim();

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw.split('\n').filter(Boolean).pop() || '{}');
  } catch {
    parsed = { ok: false, error: `parse-failed`, raw: raw.slice(0, 1000), stderr: proc.stderr.slice(0, 1000) };
  }

  const doneTs = new Date().toISOString();
  const status = parsed.ok ? 'done' : (proc.code === 10 ? 'paused_quota' : proc.code === 20 ? 'paused_human' : 'failed');
  const result = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result || null);
  const error = parsed.ok ? null : (parsed.error || proc.stderr || `exit=${proc.code}`);

  const { error: uErr } = await sb
    .from('mc_jobs')
    .update({
      status,
      result,
      error,
      completed_at: doneTs,
      last_run_json: parsed,
      last_error: error,
      last_log_path: LOG_PATH,
    })
    .eq('id', claimed.id);

  if (uErr) {
    await appendRunnerLog(`update-failed job=${claimed.id} err=${uErr.message}`);
    return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  }

  await appendRunnerLog(`run-finish job=${claimed.id} status=${status} code=${proc.code}`);
  return NextResponse.json({ ok: true, job_id: claimed.id, status, result, error, log_path: LOG_PATH, raw: parsed });
}
