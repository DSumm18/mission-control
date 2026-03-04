/**
 * Messages list endpoint
 *
 * GET /api/ed/conversations/:id/messages?limit=50
 */

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const limit = Number(req.nextUrl.searchParams.get("limit") || "50");
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("mc_ed_messages")
    .select(
      "id, conversation_id, role, content, actions_taken, metadata, model_used, duration_ms, created_at",
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Map metadata.sender to top-level sender field for the UI
  const messages = (data || []).map((m) => ({
    ...m,
    sender:
      (m.metadata as Record<string, unknown>)?.sender ||
      (m.role === "user" ? "david" : "ed"),
  }));

  return Response.json(messages);
}
