import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { requireRoleFromBearer } from '@/lib/auth/require-role';

export async function POST(req: NextRequest) {
  try {
    await requireRoleFromBearer(req.headers.get('authorization'), ['owner','admin','system']);
    const sb = supabaseAdmin();
    const { data: task } = await sb.from('tasks').select('*').eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!task) return NextResponse.json({ ok: true, message: 'no queued tasks' });

    await sb.from('tasks').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', task.id);
    // MVP: mark complete. In prod this would call workflow executor + /api/llm.
    await sb.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id);
    await sb.from('activity_logs').insert({ actor_user_id: task.created_by, entity_type: 'task', entity_id: task.id, action: 'run_completed', payload: {} });

    return NextResponse.json({ ok: true, taskId: task.id });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 403 });
  }
}
