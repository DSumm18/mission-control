/**
 * System Health Check API.
 * GET /api/health
 *
 * Runs diagnostics across all MC subsystems and returns a report.
 * Used by Ed's health_check action to self-verify the platform is working.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

async function runCheck(name: string, fn: () => Promise<string>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, detail, ms: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, ok: false, detail: msg, ms: Date.now() - start };
  }
}

export async function GET() {
  const sb = supabaseAdmin();
  const checks: CheckResult[] = [];

  // 1. Supabase connectivity
  checks.push(await runCheck('Supabase', async () => {
    const { data, error } = await sb.from('mc_settings').select('key').limit(1);
    if (error) throw new Error(error.message);
    return 'Connected';
  }));

  // 2. Job queue health
  checks.push(await runCheck('Job queue', async () => {
    const { data: queued } = await sb.from('mc_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued');
    const { data: running } = await sb.from('mc_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running');
    const { count: queuedCount } = await sb.from('mc_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued');
    const { count: runningCount } = await sb.from('mc_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running');
    return `${queuedCount ?? 0} queued, ${runningCount ?? 0} running`;
  }));

  // 3. Stalled jobs (running > 10 min)
  checks.push(await runCheck('Stalled jobs', async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, count } = await sb
      .from('mc_jobs')
      .select('id, title', { count: 'exact' })
      .eq('status', 'running')
      .lt('started_at', tenMinAgo);
    if (count && count > 0) {
      const titles = (data || []).slice(0, 3).map(j => j.title).join(', ');
      throw new Error(`${count} stalled: ${titles}`);
    }
    return 'None stalled';
  }));

  // 4. Failed jobs in last hour
  checks.push(await runCheck('Recent failures', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from('mc_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gt('completed_at', oneHourAgo);
    const n = count ?? 0;
    if (n > 5) throw new Error(`${n} failures in last hour`);
    return n === 0 ? 'No failures in last hour' : `${n} failure${n > 1 ? 's' : ''} in last hour`;
  }));

  // 5. Scheduler status (check if launchd service is running)
  checks.push(await runCheck('Scheduler', async () => {
    try {
      const out = execSync('launchctl list com.missioncontrol.scheduler 2>&1', {
        encoding: 'utf-8',
        timeout: 3000,
      });
      if (out.includes('PID')) return 'Running';
      // Parse PID from output
      const pidMatch = out.match(/"PID"\s*=\s*(\d+)/);
      if (pidMatch) return `Running (PID ${pidMatch[1]})`;
      return 'Loaded';
    } catch {
      throw new Error('Not running');
    }
  }));

  // 6. Ed Telegram bridge
  checks.push(await runCheck('Telegram bridge', async () => {
    try {
      const out = execSync('launchctl list com.missioncontrol.ed-telegram 2>&1', {
        encoding: 'utf-8',
        timeout: 3000,
      });
      const pidMatch = out.match(/"PID"\s*=\s*(\d+)/);
      if (pidMatch) return `Running (PID ${pidMatch[1]})`;
      if (out.includes('PID')) return 'Running';
      return 'Loaded';
    } catch {
      throw new Error('Not running');
    }
  }));

  // 7. Cloudflare tunnel
  checks.push(await runCheck('Cloudflare tunnel', async () => {
    try {
      const out = execSync('launchctl list com.missioncontrol.cloudflared 2>&1', {
        encoding: 'utf-8',
        timeout: 3000,
      });
      const pidMatch = out.match(/"PID"\s*=\s*(\d+)/);
      if (pidMatch) return `Running (PID ${pidMatch[1]})`;
      if (out.includes('PID')) return 'Running';
      return 'Loaded';
    } catch {
      throw new Error('Not running');
    }
  }));

  // 8. Agents health (check for inactive/paused agents)
  checks.push(await runCheck('Agents', async () => {
    const { data: agents } = await sb
      .from('mc_agents')
      .select('name, active, consecutive_failures')
      .order('name');
    const activeCount = (agents || []).filter(a => a.active).length;
    const inactive = (agents || []).filter(a => !a.active);
    const total = (agents || []).length;
    if (inactive.length > 0) {
      const names = inactive.map(a => a.name).join(', ');
      throw new Error(`${activeCount}/${total} active — paused: ${names}`);
    }
    return `${activeCount}/${total} active`;
  }));

  // 9. Disk space
  checks.push(await runCheck('Disk space', async () => {
    const dfOut = execSync("df -g / | tail -1", { encoding: 'utf-8', timeout: 3000 });
    const parts = dfOut.trim().split(/\s+/);
    const freeGb = parseInt(parts[3] || '0');
    if (freeGb < 5) throw new Error(`Only ${freeGb}GB free`);
    return `${freeGb}GB free`;
  }));

  // 10. Pending notifications (undelivered)
  checks.push(await runCheck('Notifications', async () => {
    const { count } = await sb
      .from('mc_ed_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    const n = count ?? 0;
    return n === 0 ? 'All delivered' : `${n} pending`;
  }));

  // 11. Pause flag
  checks.push(await runCheck('Pause flag', async () => {
    const { data } = await sb
      .from('mc_settings')
      .select('value')
      .eq('key', 'pause_all')
      .single();
    const val = data?.value;
    const paused = typeof val === 'object' && val !== null ? (val as Record<string, unknown>).enabled : false;
    if (paused) throw new Error('System is PAUSED');
    return 'Not paused';
  }));

  // 12. Env var health
  checks.push(await runCheck('Env vars', async () => {
    const { data } = await sb
      .from('mc_env_health')
      .select('project_id, health_score')
      .lt('health_score', 50);
    if (data?.length) {
      const { data: projects } = await sb
        .from('mc_projects')
        .select('id, name')
        .in('id', data.map(e => e.project_id));
      const names = (projects || []).map(p => `${p.name} (${data.find(d => d.project_id === p.id)?.health_score}/100)`);
      throw new Error(`Critical: ${names.join(', ')}`);
    }
    return 'All projects OK';
  }));

  // Summary
  const passed = checks.filter(c => c.ok).length;
  const failed = checks.filter(c => !c.ok).length;
  const totalMs = checks.reduce((s, c) => s + c.ms, 0);

  return Response.json({
    ok: failed === 0,
    passed,
    failed,
    total: checks.length,
    duration_ms: totalMs,
    checks,
    timestamp: new Date().toISOString(),
  });
}
