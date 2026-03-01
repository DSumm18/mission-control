/**
 * Env Health Check.
 * GET  /api/env/health?project_id=uuid  → cached health for one project
 * GET  /api/env/health                  → cached health for all projects
 * POST /api/env/health                  → refresh (re-fetch from Vercel + local)
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { checkProjectEnvHealth, checkAllProjectsEnvHealth } from '@/lib/env/health-checker';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  const sb = supabaseAdmin();

  if (projectId) {
    const { data, error } = await sb
      .from('mc_env_health')
      .select('*')
      .eq('project_id', projectId)
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ health: data });
  }

  // All projects
  const { data, error } = await sb
    .from('mc_env_health')
    .select('*, mc_projects(name)')
    .order('health_score', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ health: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectId = (body as Record<string, string>).project_id;

    if (projectId) {
      const report = await checkProjectEnvHealth(projectId);
      return Response.json({ ok: true, report });
    }

    // Refresh all
    const reports = await checkAllProjectsEnvHealth();
    return Response.json({ ok: true, reports });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
