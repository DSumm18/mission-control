/**
 * Ed Conversations API
 *
 * GET  /api/ed/conversations → list conversations
 * POST /api/ed/conversations → create new conversation
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_ed_conversations')
    .select('id, title, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  let title = 'New conversation';
  try {
    const body = await req.json();
    if (body.title) title = body.title;
  } catch {
    // Use default title
  }

  const { data, error } = await sb
    .from('mc_ed_conversations')
    .insert({ title })
    .select('id, title, is_active, created_at, updated_at')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
