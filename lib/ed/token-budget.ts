/**
 * Token budget tracking and enforcement.
 *
 * Append-only ledger (mc_token_usage) records every usage event.
 * Per-agent budgets are checked after each event — if an agent exceeds
 * its daily budget and hasn't already checked in today, it gets paused
 * and a notification is sent to David.
 */

import { supabaseAdmin } from "@/lib/db/supabase-server";
import { getSettingJson } from "@/lib/db/settings";
import { createNotification } from "@/lib/ed/notifications";

interface RecordUsageParams {
  agentId: string;
  sourceType: "chat" | "job" | "estimate";
  sourceId?: string;
  tokensIn: number;
  tokensOut: number;
  engine?: string;
  model?: string;
}

/**
 * Log a token usage event to the ledger.
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const sb = supabaseAdmin();
  await sb.from("mc_token_usage").insert({
    agent_id: params.agentId,
    source_type: params.sourceType,
    source_id: params.sourceId || null,
    tokens_in: params.tokensIn,
    tokens_out: params.tokensOut,
    engine: params.engine || null,
    model_used: params.model || null,
  });
}

/**
 * Sum today's token usage for an agent (tokens_in + tokens_out).
 */
export async function getDailyUsage(agentId: string): Promise<number> {
  const sb = supabaseAdmin();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Supabase JS doesn't have SUM, so we fetch today's rows and sum in JS.
  // For high-volume agents this is fine — typically <100 rows/day.
  const { data: rows } = await sb
    .from("mc_token_usage")
    .select("tokens_in, tokens_out")
    .eq("agent_id", agentId)
    .gte("created_at", todayStart.toISOString());

  if (!rows?.length) return 0;
  return rows.reduce(
    (sum, r) => sum + (r.tokens_in || 0) + (r.tokens_out || 0),
    0,
  );
}

/**
 * Check if an agent has exceeded its daily token budget.
 * If over budget and not already checked in today → pause + notify.
 */
export async function checkTokenBudget(agentId: string): Promise<void> {
  const sb = supabaseAdmin();

  // Load agent info
  const { data: agent } = await sb
    .from("mc_agents")
    .select("id, name, daily_token_budget, budget_paused_at, cost_tier, status")
    .eq("id", agentId)
    .single();

  if (!agent || agent.status !== "active") return;

  // Determine budget: per-agent override > tier default
  let budget = agent.daily_token_budget;
  if (budget == null) {
    const tierBudgets = await getSettingJson<Record<string, number>>(
      "token_budget_by_tier",
    );
    budget = tierBudgets?.[agent.cost_tier] ?? null;
  }

  // No budget set (or 0) = unlimited
  if (!budget || budget <= 0) return;

  // Already checked in today? Don't re-pause.
  if (agent.budget_paused_at) {
    const pausedDate = new Date(agent.budget_paused_at);
    const today = new Date();
    if (
      pausedDate.getFullYear() === today.getFullYear() &&
      pausedDate.getMonth() === today.getMonth() &&
      pausedDate.getDate() === today.getDate()
    ) {
      return; // Already paused and (presumably) reactivated today
    }
  }

  // Check usage
  const usage = await getDailyUsage(agentId);
  if (usage <= budget) return;

  // Over budget — pause agent and notify
  await sb
    .from("mc_agents")
    .update({
      status: "paused",
      budget_paused_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  await createNotification({
    title: `Token budget exceeded: ${agent.name}`,
    body: `${agent.name} used ${usage.toLocaleString()} tokens today (budget: ${budget.toLocaleString()}). Agent paused — reactivate to continue.`,
    category: "agent_budget",
    priority: "high",
    source_type: "agent",
    source_id: agentId,
  });
}

/**
 * Estimate token count from text length (fallback when real counts unavailable).
 * Rough approximation: 1 token ≈ 4 characters.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
