/**
 * Engine config API for Ed's multi-engine resilience.
 *
 * GET  /api/ed/engine-config → { engine_priority, claude_quota_until }
 * PUT  /api/ed/engine-config → updates mc_settings
 *
 * Header: x-runner-token
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSetting, getSettingJson } from "@/lib/db/settings";
import { supabaseAdmin } from "@/lib/db/supabase-server";

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-runner-token") || "";
  return !!process.env.MC_RUNNER_TOKEN && token === process.env.MC_RUNNER_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const priority = (await getSettingJson<string[]>("ed_engine_priority")) || [
    "claude",
    "gemini",
    "codex",
  ];
  const quotaUntil = (await getSetting("claude_quota_until")) || "0";

  return Response.json({
    engine_priority: priority,
    claude_quota_until: Number(quotaUntil),
  });
}

export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { engine_priority?: string[]; claude_quota_until?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  if (body.engine_priority) {
    const valid = body.engine_priority.every((e) =>
      ["claude", "gemini", "codex"].includes(e),
    );
    if (!valid) {
      return Response.json(
        { error: "Invalid engine names — must be claude, gemini, or codex" },
        { status: 400 },
      );
    }
    await sb
      .from("mc_settings")
      .upsert(
        {
          key: "ed_engine_priority",
          value: JSON.stringify(body.engine_priority),
        },
        { onConflict: "key" },
      );
  }

  if (body.claude_quota_until !== undefined) {
    await sb
      .from("mc_settings")
      .upsert(
        { key: "claude_quota_until", value: String(body.claude_quota_until) },
        { onConflict: "key" },
      );
  }

  return Response.json({ ok: true });
}
