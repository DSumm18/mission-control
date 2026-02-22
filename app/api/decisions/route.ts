import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { requireRoleFromBearer } from '@/lib/auth/require-role';

const Body = z.object({ decisionId: z.string().uuid(), action: z.enum(['approve','reject','request_changes']), note: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoleFromBearer(req.headers.get('authorization'), ['owner','admin']);
    const body = Body.parse(await req.json());
    const statusMap = { approve: 'approved', reject: 'rejected', request_changes: 'changes_requested' } as const;
    const sb = supabaseAdmin();

    await sb.from('decisions').update({ status: statusMap[body.action], decided_by: auth.userId, decided_at: new Date().toISOString(), decision_note: body.note || null }).eq('id', body.decisionId);
    await sb.from('activity_logs').insert({
      actor_user_id: auth.userId,
      entity_type: 'decision',
      entity_id: body.decisionId,
      action: body.action,
      payload: { note: body.note || null }
    });

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 403 });
  }
}
