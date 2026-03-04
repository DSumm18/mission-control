/**
 * GET /api/bridge/status
 * Returns OpenClaw gateway health status.
 */
export const runtime = "nodejs";

import { openclawHealth } from "@/lib/ed/openclaw-stream";

export async function GET() {
  try {
    const status = await openclawHealth();
    return Response.json({ ok: true, gateway: status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
