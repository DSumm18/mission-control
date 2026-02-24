import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

export const runtime = 'nodejs';

type RunnerJson = {
  status: 'OK' | 'FAILED' | 'PAUSED_QUOTA' | 'PAUSED_HUMAN';
  engine_used: string;
  model_used: string;
  start_timestamp: string;
  end_timestamp: string;
  log_path: string;
  error_summary?: string | null;
};

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

function mapStatus(status: RunnerJson['status']) {
  switch (status) {
    case 'OK':
      return 'done';
    case 'PAUSED_HUMAN':
      return 'paused_human';
    case 'PAUSED_QUOTA':
      return 'paused_quota';
    case 'FAILED':
    default:
      return 'failed';
  }
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const sb = supabaseAdmin();
  const { id: jobId } = await context.params;

  const { data: job, error: loadError } = await sb
    .from('mc_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (loadError || !job) {
    return NextResponse.json({ error: loadError?.message || 'Job not found' }, { status: 404 });
  }

  await sb.from('mc_jobs').update({ status: 'running', last_error: null }).eq('id', jobId);

  const workspace = path.join(os.homedir(), '.openclaw', 'workspace');
  const tmpDir = path.join(workspace, 'tmp-jobs');
  const ext = job.engine === 'shell' ? 'sh' : 'txt';
  const promptPath = path.join(tmpDir, `${jobId}.${ext}`);
  const runnerPath = path.join(workspace, 'scripts', 'engine-runner.sh');

  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(promptPath, `${job.prompt_text}\n`, 'utf8');

  const args = [
    '--job-id',
    jobId,
    '--engine',
    job.engine,
    '--repo-path',
    job.repo_path,
    '--prompt-file',
    promptPath,
    '--output-dir',
    job.output_dir,
  ];

  const proc = await runProcess(runnerPath, args);

  const lastLine = proc.stdout.trim().split('\n').filter(Boolean).pop();
  let parsed: RunnerJson | null = null;

  if (lastLine) {
    try {
      parsed = JSON.parse(lastLine) as RunnerJson;
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    const fallback = {
      status: 'FAILED' as const,
      engine_used: job.engine,
      model_used: '',
      start_timestamp: new Date().toISOString(),
      end_timestamp: new Date().toISOString(),
      log_path: '',
      error_summary: `Runner output parse error. exit=${proc.code}. stderr=${proc.stderr.slice(0, 500)}`,
    };

    await sb
      .from('mc_jobs')
      .update({
        status: 'failed',
        last_run_json: fallback,
        last_log_path: null,
        last_error: fallback.error_summary,
      })
      .eq('id', jobId);

    return NextResponse.json(fallback, { status: 500 });
  }

  const mapped = mapStatus(parsed.status);
  const lastError = parsed.error_summary || (mapped === 'failed' ? `Runner exited with code ${proc.code}` : null);

  await sb
    .from('mc_jobs')
    .update({
      status: mapped,
      last_run_json: parsed,
      last_log_path: parsed.log_path || null,
      last_error: lastError,
    })
    .eq('id', jobId);

  return NextResponse.json(parsed);
}
