import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { routeJob } from '@/lib/org/agent-router';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

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

async function getLogSha256OrNull(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.MC_RUNNER_TOKEN;
  const got = req.headers.get('x-runner-token') || '';

  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = supabaseAdmin();

  const proxyError = 'AntiGravity proxy not running on :8080';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const health = await fetch('http://localhost:8080/health', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!health.ok) {
      const { data: queuedForPause } = await sb
        .from('mc_jobs')
        .select('id')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (queuedForPause?.id) {
        const now = new Date().toISOString();
        const evidenceSha = await getLogSha256OrNull(LOG_PATH);
        await sb
          .from('mc_jobs')
          .update({
            status: 'paused_proxy',
            error: proxyError,
            completed_at: now,
            last_error: proxyError,
            last_log_path: LOG_PATH,
            verified_at: now,
            evidence_log_path: LOG_PATH,
            evidence_sha256: evidenceSha,
          })
          .eq('id', queuedForPause.id);
      }

      await appendRunnerLog(`run-paused-proxy reason=health-status-${health.status}`);
      return NextResponse.json({ ok: true, status: 'paused_proxy', error: proxyError, code: 20 });
    }
  } catch {
    const { data: queuedForPause } = await sb
      .from('mc_jobs')
      .select('id')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queuedForPause?.id) {
      const now = new Date().toISOString();
      const evidenceSha = await getLogSha256OrNull(LOG_PATH);
      await sb
        .from('mc_jobs')
        .update({
          status: 'paused_proxy',
          error: proxyError,
          completed_at: now,
          last_error: proxyError,
          last_log_path: LOG_PATH,
          verified_at: now,
          evidence_log_path: LOG_PATH,
          evidence_sha256: evidenceSha,
        })
        .eq('id', queuedForPause.id);
    }

    await appendRunnerLog('run-paused-proxy reason=health-check-failed');
    return NextResponse.json({ ok: true, status: 'paused_proxy', error: proxyError, code: 20 });
  }

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
  const mcpServers: string[] = claimed.mcp_servers || [];
  const args = [
    '--job-id', claimed.id,
    '--engine', claimed.engine,
    '--repo', claimed.repo_path,
    '--command', claimed.command || claimed.prompt_text,
    '--args', JSON.stringify(claimed.args || []),
    ...(mcpServers.length > 0 ? ['--mcp-servers', mcpServers.join(',')] : []),
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
  const evidenceSha = status === 'done' ? await getLogSha256OrNull(LOG_PATH) : null;

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
      verified_at: status === 'done' ? doneTs : null,
      evidence_log_path: status === 'done' ? LOG_PATH : null,
      evidence_sha256: status === 'done' ? evidenceSha : null,
    })
    .eq('id', claimed.id);

  if (uErr) {
    await appendRunnerLog(`update-failed job=${claimed.id} err=${uErr.message}`);
    return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  }

  await appendRunnerLog(`run-finish job=${claimed.id} status=${status} code=${proc.code}`);

  // --- Post-execution: Agent routing + QA trigger ---
  if (status === 'done') {
    try {
      // 1. If job has no agent_id, assign one
      if (!claimed.agent_id) {
        const route = await routeJob(claimed.id);
        if (route) {
          await sb
            .from('mc_jobs')
            .update({ agent_id: route.agent_id })
            .eq('id', claimed.id);
          await appendRunnerLog(`agent-assigned job=${claimed.id} agent=${route.agent_name}`);
        }
      }

      // 2. Set status to 'reviewing', create review job for Inspector
      await sb
        .from('mc_jobs')
        .update({ status: 'reviewing' })
        .eq('id', claimed.id);

      const { data: inspector } = await sb
        .from('mc_agents')
        .select('id')
        .eq('name', 'Inspector')
        .single();

      if (inspector) {
        await sb.from('mc_jobs').insert({
          title: `QA Review: ${claimed.title}`,
          engine: 'claude',
          repo_path: claimed.repo_path,
          prompt_text: `Review the output of job "${claimed.title}" and score on 5 dimensions (completeness, accuracy, actionability, revenue_relevance, evidence) each 1-10. Result: ${(result || '').slice(0, 2000)}`,
          output_dir: claimed.output_dir,
          status: 'queued',
          parent_job_id: claimed.id,
          agent_id: inspector.id,
          job_type: 'review',
          source: 'orchestrator',
          priority: 2,
        });
        await appendRunnerLog(`review-queued job=${claimed.id}`);
      }

      // 3. Check parent completion: if all sibling sub-tasks done
      if (claimed.parent_job_id) {
        const { data: siblings } = await sb
          .from('mc_jobs')
          .select('id, status')
          .eq('parent_job_id', claimed.parent_job_id)
          .neq('job_type', 'review');

        const allDone = siblings?.every((s) =>
          s.status === 'done' || s.status === 'reviewing'
        );

        if (allDone && siblings && siblings.length > 0) {
          const { data: ed } = await sb
            .from('mc_agents')
            .select('id')
            .eq('name', 'Ed')
            .single();

          if (ed) {
            await sb.from('mc_jobs').insert({
              title: `Integration: merge results from parent ${claimed.parent_job_id}`,
              engine: 'claude',
              repo_path: claimed.repo_path,
              prompt_text: `All sub-tasks for parent job ${claimed.parent_job_id} are complete. Review and integrate the results.`,
              output_dir: claimed.output_dir,
              status: 'queued',
              parent_job_id: claimed.parent_job_id,
              agent_id: ed.id,
              job_type: 'integration',
              source: 'orchestrator',
              priority: 3,
            });
            await appendRunnerLog(`integration-queued parent=${claimed.parent_job_id}`);
          }
        }
      }
    } catch (postErr) {
      await appendRunnerLog(`post-exec-error job=${claimed.id} err=${postErr}`);
    }
  }

  return NextResponse.json({ ok: true, job_id: claimed.id, status, result, error, log_path: LOG_PATH, raw: parsed });
}
