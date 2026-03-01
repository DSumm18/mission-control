/**
 * Env Var Manifest CRUD.
 * GET    /api/env/manifest?project_id=uuid  → list expected keys
 * POST   /api/env/manifest                  → add expected key
 * DELETE /api/env/manifest?id=uuid          → remove expected key
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return Response.json({ error: 'project_id required' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('mc_env_manifest')
    .select('*')
    .eq('project_id', projectId)
    .order('key_name');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ manifest: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, key_name, required, target, notes } = body;
    if (!project_id || !key_name) {
      return Response.json({ error: 'project_id and key_name required' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('mc_env_manifest')
      .upsert(
        {
          project_id,
          key_name,
          required: required ?? true,
          target: target || ['production', 'preview', 'development'],
          notes: notes || null,
        },
        { onConflict: 'project_id,key_name' },
      )
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, entry: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'id required' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from('mc_env_manifest').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
