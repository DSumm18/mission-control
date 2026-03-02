import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get('project_id');
  const status = sp.get('status');

  const sb = supabaseAdmin();
  let q = sb
    .from('mc_project_deliverables')
    .select('*, mc_projects(name), mc_jobs(title)')
    .order('created_at', { ascending: false });

  if (projectId) q = q.eq('project_id', projectId);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ deliverables: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { project_id, title, deliverable_type, content, source_job_id } = body;

  if (!project_id || !title) {
    return Response.json({ error: 'project_id and title are required' }, { status: 400 });
  }

  const validTypes = ['prd', 'spec', 'research', 'analysis', 'design', 'other'];
  const type = validTypes.includes(deliverable_type) ? deliverable_type : 'other';

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('mc_project_deliverables')
    .insert({
      project_id,
      title,
      deliverable_type: type,
      content: content || '',
      source_job_id: source_job_id || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ deliverable: data }, { status: 201 });
}
