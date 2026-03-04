/**
 * System prompt API endpoint for Telegram bridge.
 *
 * GET /api/ed/system-prompt
 * Header: x-runner-token
 * Response: { prompt: string }
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/ed/system-prompt";
import { buildContextBlock } from "@/lib/ed/context";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-runner-token") || "";
  if (!process.env.MC_RUNNER_TOKEN || token !== process.env.MC_RUNNER_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contextBlock = await buildContextBlock();
  const prompt = buildSystemPrompt(contextBlock);
  return Response.json({ prompt });
}
