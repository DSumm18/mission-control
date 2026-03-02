import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { routeJob } from "@/lib/org/agent-router";
import { composePrompt, getAgentMCPServers } from "@/lib/org/prompt-composer";
import { scoreJob, type QAScores } from "@/lib/org/quality-scorer";
import { decomposeJob } from "@/lib/org/decomposer";
import { createNotification } from "@/lib/ed/notifications";
import { checkAutoDispatch } from "@/lib/ed/auto-dispatch";
import { maybeCreateDeliverable } from "@/lib/deliverables/auto-extract";
import {
  recordChallengeResponse,
  synthesiseBoard,
} from "@/lib/ed/challenge-board";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const LOG_PATH = path.join(process.cwd(), "logs", "jobs-runner.log");

async function appendRunnerLog(line: string) {
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.appendFile(
    LOG_PATH,
    `${new Date().toISOString()} ${line}\n`,
    "utf8",
  );
}

function runProcess(cmd: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string; code: number }>(
    (resolve) => {
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("close", (code) =>
        resolve({ stdout, stderr, code: code ?? 30 }),
      );
      child.on("error", (err) =>
        resolve({ stdout, stderr: `${stderr}\n${err.message}`, code: 30 }),
      );
    },
  );
}

async function getLogSha256OrNull(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.MC_RUNNER_TOKEN;
  const got = req.headers.get("x-runner-token") || "";

  if (!expected || got !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();

  // Proxy check removed — ag_run.sh handles fallback to direct CLI
  const { data: queued, error: qErr } = await sb
    .from("mc_jobs")
    .select("*")
    .eq("status", "queued")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (qErr) {
    await appendRunnerLog(`queue-read-error ${qErr.message}`);
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  if (!queued) {
    await appendRunnerLog("no-queued-jobs");
    return NextResponse.json({ ok: true, message: "no queued jobs" });
  }

  const claimTs = new Date().toISOString();
  const { data: claimed, error: cErr } = await sb
    .from("mc_jobs")
    .update({ status: "running", started_at: claimTs, last_error: null })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (cErr || !claimed) {
    await appendRunnerLog(
      `claim-failed job=${queued.id} err=${cErr?.message || "already claimed"}`,
    );
    return NextResponse.json(
      { ok: false, message: "claim failed" },
      { status: 409 },
    );
  }

  // --- Agent routing: assign agent if not set ---
  let agentId = claimed.agent_id;
  let modelId: string | null = null;
  let agentSystemPrompt: string | null = null;

  if (!agentId) {
    const route = await routeJob(claimed.id);
    if (route) {
      agentId = route.agent_id;
      await sb
        .from("mc_jobs")
        .update({ agent_id: route.agent_id })
        .eq("id", claimed.id);
      await appendRunnerLog(
        `agent-assigned job=${claimed.id} agent=${route.agent_name}`,
      );
    }
  }

  // --- Load agent details for model + system prompt ---
  if (agentId) {
    const { data: agent } = await sb
      .from("mc_agents")
      .select("model_id, system_prompt")
      .eq("id", agentId)
      .single();
    if (agent) {
      modelId = agent.model_id || null;
      agentSystemPrompt = agent.system_prompt || null;
    }
  }

  // --- Compose prompt using prompt-composer ---
  let composedPrompt: string | null = null;
  if (agentId) {
    try {
      composedPrompt = await composePrompt(claimed.id, agentId);
    } catch (err) {
      await appendRunnerLog(
        `compose-prompt-error job=${claimed.id} err=${err}`,
      );
    }
  }

  // --- Get agent's MCP servers from skill assignments ---
  let agentMcpServers = "";
  if (agentId) {
    try {
      agentMcpServers = await getAgentMCPServers(agentId);
    } catch {
      // Fall back to job-level MCP servers
    }
  }

  // Use composed prompt if available, fall back to raw job prompt
  // Shell jobs always use raw prompt_text — composed prompts add agent instructions that break shell commands
  const commandText =
    claimed.engine === "shell"
      ? claimed.command || claimed.prompt_text
      : composedPrompt || claimed.command || claimed.prompt_text;

  // Merge MCP servers: agent skills + job-level
  const jobMcpServers: string[] = claimed.mcp_servers || [];
  const allMcpServers = new Set<string>([
    ...agentMcpServers.split(",").filter(Boolean),
    ...jobMcpServers,
  ]);
  const mcpServersStr = [...allMcpServers].join(",");

  const runner = path.join(process.cwd(), "scripts", "ag_run.sh");
  const args = [
    "--job-id",
    claimed.id,
    "--engine",
    claimed.engine,
    "--repo",
    claimed.repo_path || process.cwd(),
    "--command",
    commandText,
    "--args",
    JSON.stringify(claimed.args || []),
    ...(mcpServersStr ? ["--mcp-servers", mcpServersStr] : []),
    ...(modelId && claimed.engine === "claude" ? ["--model", modelId] : []),
    ...(agentSystemPrompt && claimed.engine === "claude"
      ? ["--system-prompt", agentSystemPrompt]
      : []),
  ];

  await appendRunnerLog(
    `run-start job=${claimed.id} engine=${claimed.engine} agent=${agentId || "none"} model=${modelId || "default"} repo=${claimed.repo_path}`,
  );

  const proc = await runProcess(runner, args);
  const raw = proc.stdout.trim();

  let parsed: Record<string, unknown> = {};
  try {
    // Try last non-empty line first (normal case)
    const lastLine = raw.split("\n").filter(Boolean).pop() || "{}";
    parsed = JSON.parse(lastLine);
  } catch {
    // Fallback: scan all lines for a JSON object (handles debug output before JSON)
    const lines = raw.split("\n");
    let found = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.endsWith("}")) {
        try {
          parsed = JSON.parse(line);
          found = true;
          break;
        } catch {
          /* try next line */
        }
      }
    }
    if (!found) {
      parsed = {
        ok: false,
        error: "parse-failed",
        raw: raw.slice(0, 1000),
        stderr: proc.stderr.slice(0, 1000),
      };
      await appendRunnerLog(
        `parse-failed job=${claimed.id} raw=${raw.slice(0, 200)}`,
      );
    }
  }

  const doneTs = new Date().toISOString();
  const status = parsed.ok
    ? "done"
    : proc.code === 20
      ? "paused_human"
      : "failed";
  const result =
    typeof parsed.result === "string"
      ? parsed.result
      : JSON.stringify(parsed.result || null);
  const error = parsed.ok
    ? null
    : (parsed.error as string) || proc.stderr || `exit=${proc.code}`;
  const evidenceSha =
    status === "done" ? await getLogSha256OrNull(LOG_PATH) : null;

  const { error: uErr } = await sb
    .from("mc_jobs")
    .update({
      status,
      result,
      error,
      completed_at: doneTs,
      last_run_json: parsed,
      last_error: error,
      last_log_path: LOG_PATH,
      verified_at: status === "done" ? doneTs : null,
      evidence_log_path: status === "done" ? LOG_PATH : null,
      evidence_sha256: status === "done" ? evidenceSha : null,
    })
    .eq("id", claimed.id);

  if (uErr) {
    await appendRunnerLog(
      `update-failed job=${claimed.id} err=${uErr.message}`,
    );
    return NextResponse.json(
      { ok: false, error: uErr.message },
      { status: 500 },
    );
  }

  await appendRunnerLog(
    `run-finish job=${claimed.id} status=${status} code=${proc.code}`,
  );

  // --- Auto-create notification for David ---
  try {
    const isCodeChange = ((claimed.title as string) || "")
      .toLowerCase()
      .includes("code change");
    if (status === "done" && isCodeChange) {
      await createNotification({
        title: `Deploy ready: ${((claimed.title as string) || "").slice(0, 80)}`,
        body: `Code change complete. Build passed. Ready for Vercel deploy.`,
        category: "deploy_ready",
        priority: "high",
        source_type: "job",
        source_id: claimed.id as string,
      });
    } else if (status === "done") {
      await createNotification({
        title: `Job complete: ${((claimed.title as string) || "").slice(0, 80)}`,
        body: result?.slice(0, 200) || undefined,
        category: "job_complete",
        priority: "normal",
        source_type: "job",
        source_id: claimed.id as string,
      });
    } else if (status === "failed") {
      await createNotification({
        title: `Job failed: ${((claimed.title as string) || "").slice(0, 80)}`,
        body: error?.slice(0, 200) || undefined,
        category: "job_failed",
        priority: "high",
        source_type: "job",
        source_id: claimed.id as string,
      });
    }
  } catch (notifErr) {
    await appendRunnerLog(
      `notification-error job=${claimed.id} err=${notifErr}`,
    );
  }

  // --- Post-execution: QA pipeline ---
  if (status === "done") {
    try {
      // Handle challenge board responses: parse executive position + auto-synthesise
      if (
        claimed.source === "challenge_board" &&
        (claimed.args as Record<string, unknown>)?.board_id
      ) {
        await handleChallengeResponse(claimed, result);
      }
      // Handle review job results: auto-parse Inspector's JSON scores
      else if (claimed.job_type === "review" && claimed.parent_job_id) {
        await handleReviewResult(claimed, result);
      }
      // Handle decomposition results: auto-parse Ed's JSON sub-tasks
      else if (claimed.job_type === "decomposition") {
        await handleDecompositionResult(claimed, result);
      }
      // Skip QA for operational jobs that don't produce business content
      else if (
        claimed.engine === "shell" ||
        claimed.job_type === "integration" ||
        ((claimed.title as string) || "").startsWith("__SMOKE_TEST")
      ) {
        await appendRunnerLog(
          `qa-skipped job=${claimed.id} reason=${claimed.engine === "shell" ? "shell-job" : "operational"}`,
        );
      }
      // Regular task: send to QA review
      else {
        await queueQAReview(claimed, result);
      }
    } catch (postErr) {
      await appendRunnerLog(`post-exec-error job=${claimed.id} err=${postErr}`);
    }

    // Auto-create deliverable from planning jobs
    if (claimed.project_id) {
      try {
        const created = await maybeCreateDeliverable(claimed, result);
        if (created) {
          await appendRunnerLog(
            `deliverable-created job=${claimed.id} project=${claimed.project_id}`,
          );
        }
      } catch (delErr) {
        await appendRunnerLog(
          `deliverable-error job=${claimed.id} err=${delErr}`,
        );
      }
    }
  }

  // Run auto-dispatch checks (non-blocking)
  checkAutoDispatch().catch((err) => {
    console.error("[auto-dispatch] Error:", err);
  });

  return NextResponse.json({
    ok: true,
    job_id: claimed.id,
    status,
    result,
    error,
    log_path: LOG_PATH,
    raw: parsed,
  });
}

// --- Post-execution helpers ---

async function handleReviewResult(
  reviewJob: Record<string, unknown>,
  result: string | null,
) {
  const sb = supabaseAdmin();
  const parentJobId = reviewJob.parent_job_id as string;

  // Try to parse Inspector's JSON scores from the result
  let scores: QAScores | null = null;
  let feedback = "";

  try {
    // Find JSON in the result (Inspector might wrap it in text)
    const jsonMatch = (result || "").match(/\{[\s\S]*"completeness"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      scores = {
        completeness: clampScore(parsed.completeness),
        accuracy: clampScore(parsed.accuracy),
        actionability: clampScore(parsed.actionability),
        revenue_relevance: clampScore(parsed.revenue_relevance),
        evidence: clampScore(parsed.evidence),
      };
      feedback = parsed.feedback || "";
    }
  } catch {
    // Couldn't parse — fall back to manual review
  }

  if (scores) {
    await scoreJob(
      parentJobId,
      reviewJob.agent_id as string | null,
      scores,
      feedback,
    );
    await appendRunnerLog(
      `review-scored parent=${parentJobId} total=${scores.completeness + scores.accuracy + scores.actionability + scores.revenue_relevance + scores.evidence}`,
    );
  }
}

async function handleDecompositionResult(
  decompJob: Record<string, unknown>,
  result: string | null,
) {
  // Try to parse Ed's JSON sub-task array from the result
  try {
    const jsonMatch = (result || "").match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const subTasks = JSON.parse(jsonMatch[0]);
      if (Array.isArray(subTasks) && subTasks.length > 0) {
        const validTasks = subTasks
          .filter((t: Record<string, unknown>) => t.title && t.suggested_agent)
          .map((t: Record<string, unknown>) => ({
            title: String(t.title),
            suggested_agent: String(t.suggested_agent),
            priority: Number(t.priority) || 5,
            estimated_engine: String(t.estimated_engine || "claude"),
            prompt_text: String(t.prompt_text || t.title),
          }));

        if (validTasks.length > 0) {
          const result = await decomposeJob(decompJob.id as string, validTasks);
          await appendRunnerLog(
            `decomposition-created job=${decompJob.id} sub_tasks=${result.job_ids.length}`,
          );
        }
      }
    }
  } catch {
    // Couldn't parse — decomposition stays as-is
  }
}

async function queueQAReview(
  job: Record<string, unknown>,
  result: string | null,
) {
  const sb = supabaseAdmin();

  // Set job status to 'reviewing'
  await sb
    .from("mc_jobs")
    .update({ status: "reviewing" })
    .eq("id", job.id as string);

  const { data: inspector } = await sb
    .from("mc_agents")
    .select("id")
    .eq("name", "Inspector")
    .single();

  if (inspector) {
    await sb.from("mc_jobs").insert({
      title: `QA Review: ${job.title}`,
      engine: "claude",
      repo_path: job.repo_path,
      prompt_text: `Review the output of job "${job.title}" and score on 5 dimensions (completeness, accuracy, actionability, revenue_relevance, evidence) each 1-10. Return ONLY JSON: {"completeness":N,"accuracy":N,"actionability":N,"revenue_relevance":N,"evidence":N,"total":N,"passed":bool,"feedback":"..."}\n\nScoring guidance:\n- completeness: Does it answer the full prompt? (If output appears truncated by the review pipeline, score based on what IS present)\n- accuracy: Is the content correct and well-reasoned?\n- actionability: Can David or agents act on this immediately?\n- revenue_relevance: Does it advance business goals? (Score 7 baseline for internal/operational tasks)\n- evidence: Are claims supported with sources or data?\n\nThreshold: 35/50. If output is cut off, note it in feedback but don't penalise completeness if the visible content is substantive.\n\n## Job Output:\n${(result || "").slice(0, 8000)}`,
      output_dir: job.output_dir,
      status: "queued",
      parent_job_id: job.id,
      agent_id: inspector.id,
      job_type: "review",
      source: "orchestrator",
      priority: 2,
    });
    await appendRunnerLog(`review-queued job=${job.id}`);
  }

  // Check parent completion: if all sibling sub-tasks done
  if (job.parent_job_id) {
    const { data: siblings } = await sb
      .from("mc_jobs")
      .select("id, status")
      .eq("parent_job_id", job.parent_job_id as string)
      .neq("job_type", "review");

    const allDone = siblings?.every(
      (s) => s.status === "done" || s.status === "reviewing",
    );

    if (allDone && siblings && siblings.length > 0) {
      const { data: ed } = await sb
        .from("mc_agents")
        .select("id")
        .eq("name", "Ed")
        .single();

      if (ed) {
        await sb.from("mc_jobs").insert({
          title: `Integration: merge results from parent ${job.parent_job_id}`,
          engine: "claude",
          repo_path: job.repo_path,
          prompt_text: `All sub-tasks for parent job ${job.parent_job_id} are complete. Review and integrate the results.`,
          output_dir: job.output_dir,
          status: "queued",
          parent_job_id: job.parent_job_id,
          agent_id: ed.id,
          job_type: "integration",
          source: "orchestrator",
          priority: 3,
        });
        await appendRunnerLog(`integration-queued parent=${job.parent_job_id}`);
      }
    }
  }
}

async function handleChallengeResponse(
  job: Record<string, unknown>,
  result: string | null,
) {
  const sb = supabaseAdmin();
  const boardId = (job.args as Record<string, unknown>)?.board_id as string;
  if (!boardId) return;

  // Get agent name for this job
  let agentName = "Unknown";
  if (job.agent_id) {
    const { data: agent } = await sb
      .from("mc_agents")
      .select("name")
      .eq("id", job.agent_id as string)
      .single();
    if (agent) agentName = agent.name;
  }

  // Parse the executive's JSON response
  try {
    const jsonMatch = (result || "").match(/\{[\s\S]*"position"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      await recordChallengeResponse(boardId, agentName, {
        position: String(parsed.position || ""),
        argument: String(parsed.argument || ""),
        risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
      });
      await appendRunnerLog(
        `challenge-response-recorded job=${job.id} board=${boardId} agent=${agentName} position=${parsed.position}`,
      );
    } else {
      // Couldn't find structured JSON — record the whole result as argument
      await recordChallengeResponse(boardId, agentName, {
        position: "",
        argument: (result || "").slice(0, 1000),
        risk_flags: [],
      });
      await appendRunnerLog(
        `challenge-response-unstructured job=${job.id} board=${boardId} agent=${agentName}`,
      );
    }
  } catch (parseErr) {
    await appendRunnerLog(
      `challenge-response-parse-error job=${job.id} board=${boardId} err=${parseErr}`,
    );
  }

  // Check if all challenge jobs for this board are now complete → auto-synthesise
  try {
    const { data: boardJobs } = await sb
      .from("mc_jobs")
      .select("id, status")
      .eq("source", "challenge_board")
      .filter("args->board_id", "eq", boardId);

    const allDone = boardJobs?.every((j) => j.status === "done");
    if (allDone && boardJobs && boardJobs.length > 0) {
      const summary = await synthesiseBoard(boardId);
      if (summary) {
        await appendRunnerLog(
          `challenge-synthesised board=${boardId} responses=${boardJobs.length}`,
        );
        await createNotification({
          title: `Decision ready: ${summary.title}`,
          body: `${boardJobs.length} executives responded. Top option: ${summary.options[0]?.label} — ${summary.options[0]?.summary.slice(0, 100)}`,
          category: "decision_needed",
          priority: "high",
          source_type: "challenge_board",
          source_id: boardId,
        });
      }
    }
  } catch (synthErr) {
    await appendRunnerLog(
      `challenge-synth-error board=${boardId} err=${synthErr}`,
    );
  }
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}
