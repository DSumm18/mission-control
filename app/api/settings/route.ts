import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_settings')
    .select('*')
    .order('key', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data || [] });
}

const UpsertBody = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export async function PATCH(req: NextRequest) {
  try {
    const body = UpsertBody.parse(await req.json());
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from('mc_settings')
      .upsert({ key: body.key, value: body.value }, { onConflict: 'key' })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ setting: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
