import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_job_reviews')
    .select('*, mc_agents(name, avatar_emoji)')
    .eq('job_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ reviews: data || [] });
}
