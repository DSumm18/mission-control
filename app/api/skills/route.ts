import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('mc_skills')
    .select('id,key,category,provider,status,cost_profile,notes,created_at')
    .order('key', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ skills: data || [] });
}
