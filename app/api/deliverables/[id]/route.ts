import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { checkPlanningGate } from '@/lib/deliverables/gate-check';
import { createNotification } from '@/lib/ed/notifications';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_project_deliverables')
    .select('*, mc_projects(name), mc_jobs(title)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ deliverable: data });
}

// Valid status transitions
const TRANSITIONS: Record<string, string[]> = {
  draft: ['review'],
  review: ['approved', 'rejected'],
  rejected: ['draft'],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const sb = supabaseAdmin();

  // Load current state
  const { data: current, error: loadErr } = await sb
    .from('mc_project_deliverables')
    .select('*')
    .eq('id', id)
    .single();

  if (loadErr || !current) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const allowed = ['title', 'content', 'status', 'feedback', 'deliverable_type'];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Validate status transition
  if (updates.status) {
    const validNext = TRANSITIONS[current.status] || [];
    if (!validNext.includes(updates.status as string)) {
      return Response.json(
        { error: `Cannot transition from '${current.status}' to '${updates.status}'` },
        { status: 400 },
      );
    }

    // On approve/reject: set review metadata
    if (updates.status === 'approved' || updates.status === 'rejected') {
      updates.reviewed_at = new Date().toISOString();
      updates.reviewed_by = 'david';
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await sb
    .from('mc_project_deliverables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // On approve: check if all planning deliverables are now approved
  if (updates.status === 'approved' && current.project_id) {
    try {
      const gate = await checkPlanningGate(current.project_id);
      if (gate.allApproved) {
        await createNotification({
          title: 'Planning gate passed!',
          body: `All ${gate.total} planning deliverables approved. Project is ready for dev.`,
          category: 'job_complete',
          priority: 'high',
          source_type: 'project',
          source_id: current.project_id,
        });
      }
    } catch {
      // Non-critical — don't fail the PATCH
    }
  }

  return Response.json({ deliverable: data });
}
