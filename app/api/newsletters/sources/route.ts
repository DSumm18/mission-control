import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

const Body = z.object({
  newsletter_id: z.string().uuid(),
  source_update_id: z.string().uuid(),
  source_role: z.enum(['primary','supporting','evidence']).default('supporting'),
});

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('mc_newsletter_sources')
      .upsert(body, { onConflict: 'newsletter_id,source_update_id' })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ link: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid payload' }, { status: 400 });
  }
}
