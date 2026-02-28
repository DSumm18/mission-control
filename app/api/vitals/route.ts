/**
 * System Vitals API — macOS system stats.
 * GET /api/vitals
 * Returns CPU, memory, disk usage from the Mac Mini.
 */

import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET() {
  try {
    // CPU usage (% idle from top)
    const topOut = execSync("top -l 1 -n 0 | grep 'CPU usage'", { encoding: 'utf-8', timeout: 5000 });
    const idleMatch = topOut.match(/([\d.]+)% idle/);
    const cpuUsed = idleMatch ? round2(100 - parseFloat(idleMatch[1] || '0')) : 0;

    // Memory from vm_stat
    const vmOut = execSync('vm_stat', { encoding: 'utf-8', timeout: 5000 });
    const pageSize = 16384; // Apple Silicon default
    const freeMatch = vmOut.match(/Pages free:\s+(\d+)/);
    const activeMatch = vmOut.match(/Pages active:\s+(\d+)/);
    const inactiveMatch = vmOut.match(/Pages inactive:\s+(\d+)/);
    const wiredMatch = vmOut.match(/"Pages wired down":\s+(\d+)/);
    const compressedMatch = vmOut.match(/Pages occupied by compressor:\s+(\d+)/);

    const free = (parseInt(freeMatch?.[1] || '0') * pageSize) / 1073741824;
    const active = (parseInt(activeMatch?.[1] || '0') * pageSize) / 1073741824;
    const inactive = (parseInt(inactiveMatch?.[1] || '0') * pageSize) / 1073741824;
    const wired = (parseInt(wiredMatch?.[1] || '0') * pageSize) / 1073741824;
    const compressed = (parseInt(compressedMatch?.[1] || '0') * pageSize) / 1073741824;

    const memTotal = 16; // Known: Mac Mini M4 16GB
    const memUsed = round2(active + wired + compressed);
    const memPercent = round2((memUsed / memTotal) * 100);

    // Disk usage
    const dfOut = execSync("df -g / | tail -1", { encoding: 'utf-8', timeout: 5000 });
    const dfParts = dfOut.trim().split(/\s+/);
    const diskTotal = parseInt(dfParts[1] || '0');
    const diskUsed = parseInt(dfParts[2] || '0');
    const diskFree = parseInt(dfParts[3] || '0');
    const diskPercent = diskTotal > 0 ? round2((diskUsed / diskTotal) * 100) : 0;

    // Uptime
    const uptimeOut = execSync('uptime', { encoding: 'utf-8', timeout: 5000 });
    const uptimeMatch = uptimeOut.match(/up\s+(.+?),\s+\d+ users?/);
    const uptime = uptimeMatch?.[1]?.trim() || 'unknown';

    // Load average
    const loadMatch = uptimeOut.match(/load averages?:\s*([\d.]+)/);
    const loadAvg = loadMatch ? parseFloat(loadMatch[1]) : 0;

    return Response.json({
      cpu: { percent: cpuUsed, cores: 10 },
      memory: {
        total_gb: memTotal,
        used_gb: memUsed,
        free_gb: round2(free + inactive),
        percent: memPercent,
      },
      disk: {
        total_gb: diskTotal,
        used_gb: diskUsed,
        free_gb: diskFree,
        percent: diskPercent,
      },
      uptime,
      load_avg: loadAvg,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
