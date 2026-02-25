import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('mc_v_cost_by_engine_7d').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ costs: data || [] });
}
