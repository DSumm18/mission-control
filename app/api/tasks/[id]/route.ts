import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

const PatchBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  due_date: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  try {
    const body = PatchBody.parse(await req.json());
    const sb = supabaseAdmin();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const [key, value] of Object.entries(body)) {
      updates[key] = value;
    }

    // Auto-set completed_at when status changes to 'done'
    if (body.status === 'done' && !body.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await sb
      .from('mc_tasks')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ task: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const sb = supabaseAdmin();

  const { error } = await sb
    .from('mc_tasks')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
