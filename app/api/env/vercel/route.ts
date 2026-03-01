/**
 * Vercel Env Var Proxy.
 * GET  /api/env/vercel?vercel_project_id=prj_xxx  → list env vars (masked values)
 * POST /api/env/vercel                             → create env var
 * DELETE /api/env/vercel?vercel_project_id=prj_xxx&env_id=xxx → delete env var
 */

import { NextRequest } from 'next/server';
import { listEnvVars, createEnvVar, deleteEnvVar } from '@/lib/env/vercel-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const vercelProjectId = req.nextUrl.searchParams.get('vercel_project_id');
  if (!vercelProjectId) {
    return Response.json({ error: 'vercel_project_id required' }, { status: 400 });
  }

  try {
    const envVars = await listEnvVars(vercelProjectId);
    const masked = envVars.map(e => ({
      id: e.id,
      key: e.key,
      value_preview: e.type === 'plain' && e.value
        ? e.value.slice(0, 4) + '...'
        : `(${e.type})`,
      target: e.target,
      type: e.type,
    }));
    return Response.json({ envs: masked });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vercel_project_id, key, value, target, type } = body;
    if (!vercel_project_id || !key || !value) {
      return Response.json({ error: 'vercel_project_id, key, and value required' }, { status: 400 });
    }
    const result = await createEnvVar(vercel_project_id, key, value, target, type);
    return Response.json({ ok: true, env: { id: result.id, key: result.key } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const vercelProjectId = req.nextUrl.searchParams.get('vercel_project_id');
  const envId = req.nextUrl.searchParams.get('env_id');
  if (!vercelProjectId || !envId) {
    return Response.json({ error: 'vercel_project_id and env_id required' }, { status: 400 });
  }
  try {
    await deleteEnvVar(vercelProjectId, envId);
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
