import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { requireRoleFromBearer } from '@/lib/auth/require-role';

const Body = z.object({ projectId: z.string().uuid().optional(), title: z.string().min(1), description: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoleFromBearer(req.headers.get('authorization'), ['owner','admin','editor']);
    const body = Body.parse(await req.json());
    const sb = supabaseAdmin();
    const { data } = await sb.from('tasks').insert({
      project_id: body.projectId || null,
      title: body.title,
      description: body.description || null,
      status: 'queued',
      created_by: auth.userId
    }).select('*').single();

    await sb.from('activity_logs').insert({ actor_user_id: auth.userId, entity_type: 'task', entity_id: data.id, action: 'created', payload: {} });

    return NextResponse.json({ ok: true, task: data });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 403 });
  }
}
