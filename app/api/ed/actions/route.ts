/**
 * Action execution API endpoint for Telegram bridge.
 *
 * POST /api/ed/actions
 * Header: x-runner-token
 * Body: { actions: EdAction[] }
 * Response: { results: EdActionResult[] }
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { executeActions } from "@/lib/ed/actions";
import type { EdAction } from "@/lib/ed/types";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-runner-token") || "";
  if (!process.env.MC_RUNNER_TOKEN || token !== process.env.MC_RUNNER_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { actions: EdAction[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.actions)) {
    return Response.json(
      { error: "actions must be an array" },
      { status: 400 },
    );
  }

  const results = await executeActions(body.actions);
  return Response.json({ results });
}
