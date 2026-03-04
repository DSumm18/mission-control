/**
 * Auto-dispatch — checks for stalled/failed jobs and auto-actions.
 * Called from run-once after each job execution.
 */

import { supabaseAdmin } from "@/lib/db/supabase-server";

const STALL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — alert
const STALL_FORCE_FAIL_MS = 15 * 60 * 1000; // 15 minutes — force-fail
const MAX_RETRIES = 3;
const RESEARCH_STALE_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONSECUTIVE_FAILURES = 3;

export async function checkAutoDispatch(): Promise<void> {
  const sb = supabaseAdmin();

  try {
    // 1. Stalled jobs (running > 10 min) → alert notification
    const { data: stalledJobs } = await sb
      .from("mc_jobs")
      .select("id, title, started_at, agent_id")
      .eq("status", "running")
      .not("started_at", "is", null);

    if (stalledJobs) {
      const now = Date.now();
      for (const j of stalledJobs) {
        const elapsed = now - new Date(j.started_at!).getTime();
        // Force-fail zombie jobs (>15 min running)
        if (elapsed > STALL_FORCE_FAIL_MS) {
          await sb
            .from("mc_jobs")
            .update({
              status: "failed",
              error: `Timed out after ${Math.round(elapsed / 60000)} minutes`,
              last_error: `Timed out after ${Math.round(elapsed / 60000)} minutes`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", j.id);

          await sb.from("mc_ed_notifications").insert({
            title: `Zombie job killed: ${j.title}`,
            body: `Was running for ${Math.round(elapsed / 60000)} minutes with no response. Marked as failed for auto-retry.`,
            category: "alert",
            priority: "high",
            status: "pending",
            metadata: { job_id: j.id, type: "zombie_killed" },
          });
        } else if (elapsed > STALL_TIMEOUT_MS) {
          // Warn about stalled jobs (>10 min)
          const { data: existing } = await sb
            .from("mc_ed_notifications")
            .select("id")
            .eq("metadata->>job_id", j.id)
            .eq("category", "alert")
            .in("status", ["pending", "delivered"])
            .limit(1);

          if (!existing?.length) {
            await sb.from("mc_ed_notifications").insert({
              title: `Stalled job: ${j.title}`,
              body: `Running for ${Math.round(elapsed / 60000)} minutes. May need investigation.`,
              category: "alert",
              priority: "high",
              status: "pending",
              metadata: { job_id: j.id, type: "stalled_job" },
            });
          }
        }
      }
    }

    // 2. Failed jobs with retry_count < MAX_RETRIES → auto-requeue with engine fallback
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: failedJobs } = await sb
      .from("mc_jobs")
      .select(
        "id, title, prompt_text, engine, project_id, agent_id, repo_path, priority, job_type, retry_count, last_error",
      )
      .eq("status", "failed")
      .lt("retry_count", MAX_RETRIES)
      .gt("completed_at", oneHourAgo) // Only retry jobs that failed in the last hour
      .order("completed_at", { ascending: false })
      .limit(5);

    if (failedJobs) {
      for (const j of failedJobs) {
        const retryCount = (j.retry_count ?? 0) + 1;
        const errorStr = (j.last_error || "").toLowerCase();

        // Detect context/token/rate-limit errors that warrant engine switch
        const isContextError =
          /context.*(window|length|limit|exceed)|token.*(limit|exceed|max)|too.*(long|large)/i.test(
            errorStr,
          );
        const isRateLimitError = /rate.?limit|throttl|429|quota/i.test(
          errorStr,
        );
        const isTimeoutError = /timeout|timed?\s*out/i.test(errorStr);
        const shouldSwitchEngine =
          isContextError ||
          ((isRateLimitError || isTimeoutError) && retryCount >= 2);

        // Look up agent's fallback engine
        let newEngine = j.engine;
        let fallbackReason: string | null = null;

        if (shouldSwitchEngine && j.agent_id) {
          const { data: agent } = await sb
            .from("mc_agents")
            .select("fallback_engine")
            .eq("id", j.agent_id)
            .single();

          if (agent?.fallback_engine && agent.fallback_engine !== j.engine) {
            newEngine = agent.fallback_engine;
            fallbackReason = isContextError
              ? "context_limit"
              : isRateLimitError
                ? "rate_limit"
                : "timeout";
          }
        }

        await sb
          .from("mc_jobs")
          .update({
            status: "queued",
            retry_count: retryCount,
            engine: newEngine,
            fallback_reason: fallbackReason,
            engine_used: null, // Will be set after execution
            started_at: null,
            completed_at: null,
            result: null,
            last_error: null,
            error: null,
          })
          .eq("id", j.id);

        const engineNote =
          newEngine !== j.engine
            ? ` Engine switched: ${j.engine} → ${newEngine} (${fallbackReason}).`
            : "";

        await sb.from("mc_ed_notifications").insert({
          title: `Auto-retry: ${j.title} (attempt ${retryCount}/${MAX_RETRIES})`,
          body: `Job failed and was automatically requeued.${engineNote}`,
          category: "info",
          priority: newEngine !== j.engine ? "high" : "normal",
          status: "pending",
          metadata: {
            job_id: j.id,
            type: "auto_retry",
            retry_count: retryCount,
            engine_switch:
              newEngine !== j.engine ? `${j.engine}->${newEngine}` : null,
            fallback_reason: fallbackReason,
          },
        });
      }
    }

    // 3. Research items stale in 'captured' → auto-dispatch Scout
    const { data: staleResearch } = await sb
      .from("mc_research_items")
      .select("id, title, url, content_type")
      .eq("status", "captured")
      .lt("created_at", new Date(Date.now() - RESEARCH_STALE_MS).toISOString())
      .limit(3);

    if (staleResearch?.length) {
      for (const r of staleResearch) {
        // Check if a Scout job already exists for this research item
        const { data: existingJob } = await sb
          .from("mc_jobs")
          .select("id")
          .ilike("title", `%${r.id}%`)
          .in("status", ["queued", "running"])
          .limit(1);

        if (!existingJob?.length) {
          await sb.from("mc_jobs").insert({
            title: `Scout: ${r.title || r.url || "Research item"}`,
            prompt_text: `Assess this research item for newsletter relevance. Research item ID: ${r.id}. Title: ${r.title}. URL: ${r.url || "N/A"}. Content type: ${r.content_type}.`,
            engine: "claude",
            status: "queued",
            priority: 7,
            job_type: "task",
            source: "auto-dispatch",
          });
        }
      }
    }

    // 4. Agent consecutive_failures >= MAX_CONSECUTIVE_FAILURES → auto-pause + notify
    const { data: troubleAgents } = await sb
      .from("mc_agents")
      .select("id, name, consecutive_failures")
      .eq("active", true)
      .gte("consecutive_failures", MAX_CONSECUTIVE_FAILURES);

    if (troubleAgents?.length) {
      for (const a of troubleAgents) {
        await sb.from("mc_agents").update({ active: false }).eq("id", a.id);

        await sb.from("mc_ed_notifications").insert({
          title: `Agent paused: ${a.name}`,
          body: `${a.consecutive_failures} consecutive failures. Paused automatically. Review and reactivate when ready.`,
          category: "alert",
          priority: "high",
          status: "pending",
          metadata: {
            agent_id: a.id,
            type: "agent_paused",
            failures: a.consecutive_failures,
          },
        });
      }
    }
  } catch (err: unknown) {
    console.error(
      "[auto-dispatch] Error:",
      err instanceof Error ? err.message : err,
    );
  }
}
