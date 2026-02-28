/**
 * Job detail API — GET + PATCH for individual jobs.
 * GET /api/jobs/[id] — returns full job details
 * PATCH /api/jobs/[id] — updates job status (for drag-and-drop pipeline)
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: job, error } = await sb
    .from('mc_jobs')
    .select('*, mc_agents(name, avatar_emoji), mc_projects(name)')
    .eq('id', id)
    .single();

  if (error || !job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  return Response.json({ job });
}

const VALID_STATUSES = ['queued', 'assigned', 'running', 'reviewing', 'done', 'rejected', 'failed'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = supabaseAdmin();

  let body: { status?: string; priority?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return Response.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    updates.status = body.status;

    // Set timestamps based on status
    if (body.status === 'running') {
      updates.started_at = new Date().toISOString();
    }
    if (['done', 'failed', 'rejected'].includes(body.status)) {
      updates.completed_at = new Date().toISOString();
    }
  }

  if (body.priority !== undefined) {
    updates.priority = body.priority;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('mc_jobs')
    .update(updates)
    .eq('id', id)
    .select('id, title, status, priority')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ job: data });
}
