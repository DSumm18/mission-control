/**
 * MC_ACTION parser + executor.
 * Lifted from ed-telegram.mjs:262-441, extended with spawn_job and check_status.
 */

import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { EdAction, EdActionResult } from "./types";
import { createChallengeBoard, recordDecision } from "./challenge-board";
import { createNotification, markAcknowledged } from "./notifications";

/**
 * Parse MC_ACTION blocks from Ed's response text.
 * Returns { cleanText, actions }.
 */
export function parseActions(text: string): {
  cleanText: string;
  actions: EdAction[];
} {
  const actionRegex = /\[MC_ACTION:(\w+)\](.*?)\[\/MC_ACTION\]/gs;
  const actions: EdAction[] = [];
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      actions.push({
        type: match[1],
        params: JSON.parse(match[2]),
      });
    } catch {
      // Invalid JSON — skip
    }
  }

  const cleanText = text
    .replace(actionRegex, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanText, actions };
}

/**
 * Execute an array of MC actions and return results.
 */
export async function executeActions(
  actions: EdAction[],
): Promise<EdActionResult[]> {
  const sb = supabaseAdmin();
  const results: EdActionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "create_research": {
          const p = action.params as Record<string, string>;
          const { data, error } = await sb
            .from("mc_research_items")
            .upsert(
              {
                source_url: p.url,
                title: p.title || null,
                content_type: p.content_type || "article",
                shared_by: "david",
                status: "captured",
                why_relevant: p.notes || null,
              },
              { onConflict: "source_url" },
            )
            .select("id")
            .single();
          if (error) throw error;
          results.push({ type: "create_research", id: data.id, ok: true });
          break;
        }

        case "queue_scout": {
          const p = action.params as Record<string, string>;
          const { data: scout } = await sb
            .from("mc_agents")
            .select("id")
            .eq("name", "Scout")
            .single();

          let researchId = p.research_item_id;
          if (!researchId && p.url) {
            const { data: ri } = await sb
              .from("mc_research_items")
              .select("id")
              .eq("source_url", p.url)
              .single();
            researchId = ri?.id;
          }

          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: `Assess: ${p.title || p.url || "Research item"}`,
              prompt_text: `Assess this content for the Schoolgle Signal newsletter. URL: ${p.url || "N/A"}. Content type: ${p.content_type || "article"}. Summarise the key points, score relevance 1-10 for UK school leaders, suggest a newsletter angle, and explain WHY it matters.`,
              repo_path: "/Users/david/.openclaw/workspace/mission-control",
              engine: "claude",
              status: "queued",
              priority: 1,
              agent_id: scout?.id || null,
            })
            .select("id")
            .single();
          if (error) throw error;

          if (researchId) {
            await sb
              .from("mc_research_items")
              .update({ assessment_job_id: job.id, status: "assessing" })
              .eq("id", researchId);
          }

          results.push({ type: "queue_scout", job_id: job.id, ok: true });
          break;
        }

        case "queue_hawk": {
          const p = action.params as Record<string, string>;
          const { data: hawk } = await sb
            .from("mc_agents")
            .select("id")
            .eq("name", "Hawk")
            .single();

          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: `Deep Dive: ${p.focus || "Analysis"}`,
              prompt_text: `Deep analysis for Schoolgle Signal: ${p.focus || "General analysis"}. Provide policy context, cross-references with DfE data, implications for UK school leaders, and actionable recommendations.${p.research_item_id ? ` Research item: ${p.research_item_id}` : ""}`,
              repo_path: "/Users/david/.openclaw/workspace/mission-control",
              engine: "claude",
              status: "queued",
              priority: 1,
              agent_id: hawk?.id || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({ type: "queue_hawk", job_id: job.id, ok: true });
          break;
        }

        case "create_task": {
          const p = action.params as Record<string, string | number>;
          const { data: task, error } = await sb
            .from("mc_tasks")
            .insert({
              title: p.title,
              description: p.description || "",
              status: "todo",
              priority: p.priority || 5,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({ type: "create_task", task_id: task.id, ok: true });
          break;
        }

        case "queue_draft": {
          const p = action.params as Record<string, string>;
          const { data: ed } = await sb
            .from("mc_agents")
            .select("id")
            .eq("name", "Ed")
            .single();

          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: `Generate Draft: Newsletter ${p.newsletter_id}`,
              prompt_text: `Decompose newsletter ${p.newsletter_id} into sections. Review approved research items and generate a draft plan.`,
              repo_path: "/Users/david/.openclaw/workspace/mission-control",
              engine: "claude",
              status: "queued",
              priority: 1,
              agent_id: ed?.id || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({ type: "queue_draft", job_id: job.id, ok: true });
          break;
        }

        case "spawn_job": {
          const p = action.params as Record<string, string>;
          let agentId: string | null = null;
          if (p.agent_name) {
            const { data: agent } = await sb
              .from("mc_agents")
              .select("id")
              .ilike("name", p.agent_name)
              .single();
            agentId = agent?.id || null;
          }

          // Resolve project_name to project_id + repo_path
          let projectId: string | null = null;
          let repoPath =
            p.repo_path || "/Users/david/.openclaw/workspace/mission-control";
          if (p.project_name) {
            const { data: proj } = await sb
              .from("mc_projects")
              .select("id, repo_path")
              .ilike("name", p.project_name)
              .single();
            if (proj) {
              projectId = proj.id;
              if (proj.repo_path && !p.repo_path) repoPath = proj.repo_path;
            }
          }

          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: p.title || "Ed-spawned job",
              prompt_text: p.prompt_text || "",
              repo_path: repoPath,
              engine: p.engine || "claude",
              status: "queued",
              priority: Number(p.priority) || 3,
              agent_id: agentId,
              project_id: projectId,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({ type: "spawn_job", job_id: job.id, ok: true });
          break;
        }

        case "review_project": {
          const p = action.params as Record<string, string>;
          // Look up the project
          const { data: project } = await sb
            .from("mc_projects")
            .select("id, name, repo_path")
            .or(
              `id.eq.${p.project_id || "00000000-0000-0000-0000-000000000000"},name.ilike.%${p.project_name || ""}%`,
            )
            .limit(1)
            .single();

          if (!project) {
            results.push({
              type: "review_project",
              ok: false,
              error: `Project not found: ${p.project_name || p.project_id}`,
            });
            break;
          }

          const repoPath = project.repo_path || p.repo_path;
          if (!repoPath) {
            results.push({
              type: "review_project",
              ok: false,
              error: `No repo_path set for ${project.name}. Ask David for the repo location.`,
            });
            break;
          }

          // Find Inspector agent for code review
          const { data: inspector } = await sb
            .from("mc_agents")
            .select("id")
            .eq("name", "Inspector")
            .single();

          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: `Project Review: ${project.name}`,
              prompt_text: `Review the codebase at ${repoPath} for the ${project.name} project. Produce a status report covering:
1. What exists (files, features, infrastructure)
2. What's working vs incomplete
3. Tech stack and architecture
4. What's needed to reach MVP / first revenue
5. Estimated effort for each remaining item
6. Blockers or decisions needed from David
Output a structured JSON report with these sections.`,
              repo_path: repoPath,
              engine: "claude",
              status: "queued",
              priority: 1,
              agent_id: inspector?.id || null,
              project_id: project.id,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({
            type: "review_project",
            job_id: job.id,
            id: project.id,
            ok: true,
          });
          break;
        }

        case "plan_project": {
          const p = action.params as Record<
            string,
            | string
            | {
                title: string;
                description?: string;
                assigned_to?: string;
                task_type?: string;
                priority?: number;
              }[]
          >;
          // Look up the project
          const { data: project } = await sb
            .from("mc_projects")
            .select("id, name")
            .or(
              `id.eq.${(p.project_id as string) || "00000000-0000-0000-0000-000000000000"},name.ilike.%${(p.project_name as string) || ""}%`,
            )
            .limit(1)
            .single();

          if (!project) {
            results.push({
              type: "plan_project",
              ok: false,
              error: `Project not found`,
            });
            break;
          }

          // Create tasks from the plan
          const tasks = p.tasks as {
            title: string;
            description?: string;
            assigned_to?: string;
            task_type?: string;
            priority?: number;
          }[];
          if (!Array.isArray(tasks) || tasks.length === 0) {
            results.push({
              type: "plan_project",
              ok: false,
              error: "No tasks provided in plan",
            });
            break;
          }

          let created = 0;
          for (const t of tasks) {
            const { error: taskErr } = await sb.from("mc_tasks").insert({
              title: t.title,
              description: t.description || "",
              project_id: project.id,
              status: "todo",
              priority: t.priority || 5,
              assigned_to: t.assigned_to || "unassigned",
              task_type: t.task_type || "action",
            });
            if (!taskErr) created++;
          }

          results.push({ type: "plan_project", id: project.id, ok: true });
          break;
        }

        case "update_project": {
          const p = action.params as Record<string, string>;
          const updates: Record<string, unknown> = {};
          if (p.repo_path) updates.repo_path = p.repo_path;
          if (p.description) updates.description = p.description;
          if (p.delivery_plan)
            updates.delivery_plan = JSON.parse(p.delivery_plan);

          if (Object.keys(updates).length === 0) {
            results.push({
              type: "update_project",
              ok: false,
              error: "No fields to update",
            });
            break;
          }

          const { error } = await sb
            .from("mc_projects")
            .update(updates)
            .or(
              `id.eq.${p.project_id || "00000000-0000-0000-0000-000000000000"},name.ilike.%${p.project_name || ""}%`,
            );
          if (error) throw error;
          results.push({ type: "update_project", ok: true });
          break;
        }

        case "challenge_board": {
          const p = action.params as Record<string, unknown>;
          const challengers = (p.challengers as string[]) || [
            "Kate",
            "Kerry",
            "Nic",
            "Helen",
          ];
          const options = (p.options as string[]) || [];

          // Find project if mentioned
          let projectId: string | undefined;
          if (p.project_name) {
            const { data: proj } = await sb
              .from("mc_projects")
              .select("id")
              .ilike("name", `%${p.project_name as string}%`)
              .limit(1)
              .single();
            projectId = proj?.id;
          }

          const result = await createChallengeBoard({
            title: (p.title as string) || "Untitled Decision",
            context: (p.context as string) || "",
            options,
            challengers,
            projectId,
          });

          results.push({
            type: "challenge_board",
            id: result.board_id,
            ok: true,
          });
          break;
        }

        case "approve_task": {
          const p = action.params as Record<string, string>;
          // Find the task by title match or ID
          let taskQuery = sb.from("mc_tasks").select("id, title");
          if (p.task_id) {
            taskQuery = taskQuery.eq("id", p.task_id);
          } else if (p.title) {
            taskQuery = taskQuery.ilike("title", `%${p.title}%`);
          }
          const { data: task } = await taskQuery.limit(1).single();

          if (!task) {
            results.push({
              type: "approve_task",
              ok: false,
              error: `Task not found: ${p.title || p.task_id}`,
            });
            break;
          }

          const { error } = await sb
            .from("mc_tasks")
            .update({ status: "done", completed_at: new Date().toISOString() })
            .eq("id", task.id);
          if (error) throw error;
          results.push({ type: "approve_task", task_id: task.id, ok: true });
          break;
        }

        case "decide": {
          const p = action.params as Record<string, string>;
          // Find open challenge board
          let boardQuery = sb
            .from("mc_challenge_board")
            .select("id, decision_title");
          if (p.board_id) {
            boardQuery = boardQuery.eq("id", p.board_id);
          } else if (p.title) {
            boardQuery = boardQuery.ilike("decision_title", `%${p.title}%`);
          }
          boardQuery = boardQuery.in("status", ["open", "deliberating"]);
          const { data: board } = await boardQuery.limit(1).single();

          if (!board) {
            results.push({
              type: "decide",
              ok: false,
              error: `No open board found: ${p.title || p.board_id}`,
            });
            break;
          }

          await recordDecision(
            board.id,
            p.decision || p.option || "",
            p.rationale || "",
          );
          results.push({ type: "decide", id: board.id, ok: true });
          break;
        }

        case "update_task": {
          const p = action.params as Record<string, string>;
          let taskQuery = sb.from("mc_tasks").select("id");
          if (p.task_id) {
            taskQuery = taskQuery.eq("id", p.task_id);
          } else if (p.title) {
            taskQuery = taskQuery.ilike("title", `%${p.title}%`);
          }
          const { data: task } = await taskQuery.limit(1).single();

          if (!task) {
            results.push({
              type: "update_task",
              ok: false,
              error: `Task not found: ${p.title || p.task_id}`,
            });
            break;
          }

          const updates: Record<string, unknown> = {};
          if (p.status) updates.status = p.status;
          if (p.notes) updates.description = p.notes;
          if (p.assigned_to) updates.assigned_to = p.assigned_to;
          if (p.priority) updates.priority = Number(p.priority);
          if (p.status === "done")
            updates.completed_at = new Date().toISOString();

          const { error } = await sb
            .from("mc_tasks")
            .update(updates)
            .eq("id", task.id);
          if (error) throw error;
          results.push({ type: "update_task", task_id: task.id, ok: true });
          break;
        }

        case "request_tools": {
          const p = action.params as Record<string, string | string[]>;
          // Log the request — tools are managed via mc_agent_skills
          const agentName = p.agent_name as string;
          const tools = p.tools as string[];

          if (!agentName || !tools?.length) {
            results.push({
              type: "request_tools",
              ok: false,
              error: "Need agent_name and tools[]",
            });
            break;
          }

          const { data: agent } = await sb
            .from("mc_agents")
            .select("id")
            .eq("name", agentName)
            .single();

          if (!agent) {
            results.push({
              type: "request_tools",
              ok: false,
              error: `Agent not found: ${agentName}`,
            });
            break;
          }

          let assigned = 0;
          for (const toolKey of tools) {
            const { data: skill } = await sb
              .from("mc_skills")
              .select("id")
              .eq("key", toolKey)
              .single();

            if (skill) {
              await sb
                .from("mc_agent_skills")
                .upsert(
                  { agent_id: agent.id, skill_id: skill.id, allowed: true },
                  { onConflict: "agent_id,skill_id" },
                );
              assigned++;
            }
          }
          results.push({ type: "request_tools", ok: true });
          break;
        }

        case "code_change": {
          // Ed spawns a Claude CLI job on the Mac Mini to edit code.
          // The scheduler picks this up and runs it via ag_run.sh with full tool access.
          const p = action.params as Record<string, string>;
          const { data: kerry } = await sb
            .from("mc_agents")
            .select("id")
            .eq("name", "Kerry")
            .single();

          const repoPath =
            p.repo_path || "/Users/david/.openclaw/workspace/mission-control";
          const description = p.description || "";
          const files = p.files || "";
          const reason = p.reason || "";

          const prompt = `You are working on the Mission Control codebase at ${repoPath}.

## Task
${description}

${files ? `## Files to modify\n${files}` : ""}

${reason ? `## Why\n${reason}` : ""}

## Instructions
1. Read the relevant files first to understand the current code
2. Make the necessary changes
3. Run \`npm run build\` to verify zero errors
4. If build passes, run: git add -A && git commit -m "${(p.commit_message || description).replace(/"/g, '\\"')}\n\nCo-Authored-By: Ed (MC CEO) <ed@missioncontrol.ai>" && git push origin main
5. Report what you changed and whether the push succeeded`;

          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: `Code Change: ${description.slice(0, 80)}`,
              prompt_text: prompt,
              repo_path: repoPath,
              engine: "claude",
              status: "queued",
              priority: 1,
              agent_id: kerry?.id || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({ type: "code_change", job_id: job.id, ok: true });
          break;
        }

        case "deploy": {
          // Trigger a Vercel redeployment by pushing current code or creating a deploy hook job
          const p = action.params as Record<string, string>;
          const reason = p.reason || "Ed-triggered deployment";

          // Create a shell job that pushes the latest code (triggers Vercel auto-deploy)
          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: `Deploy: ${reason.slice(0, 60)}`,
              prompt_text: `cd /Users/david/.openclaw/workspace/mission-control && npm run build && echo "Build passed — Vercel will auto-deploy from latest push." || echo "Build FAILED — do not push."`,
              repo_path: "/Users/david/.openclaw/workspace/mission-control",
              engine: "shell",
              status: "queued",
              priority: 1,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({ type: "deploy", job_id: job.id, ok: true });
          break;
        }

        case "check_status": {
          // This is a read-only action — Ed uses the context block
          results.push({ type: "check_status", ok: true });
          break;
        }

        case "health_check": {
          // Run system health diagnostics and return results
          try {
            const baseUrl =
              process.env.MC_SERVER_URL || "http://localhost:3000";
            const res = await fetch(`${baseUrl}/api/health`, {
              signal: AbortSignal.timeout(15_000),
            });
            const health = await res.json();
            const checks = (health.checks || []) as {
              name: string;
              ok: boolean;
              detail: string;
            }[];
            const summary = checks
              .map(
                (c: { name: string; ok: boolean; detail: string }) =>
                  `${c.ok ? "OK" : "FAIL"} ${c.name}: ${c.detail}`,
              )
              .join("\n");
            results.push({
              type: "health_check",
              ok: health.ok,
              id: `${health.passed}/${health.total} passed`,
              error: health.ok ? undefined : `${health.failed} check(s) failed`,
              ...health,
              summary,
            } as EdActionResult & Record<string, unknown>);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({
              type: "health_check",
              ok: false,
              error: `Health check failed: ${msg}`,
            });
          }
          break;
        }

        case "env_health": {
          const p = action.params as Record<string, string>;
          const projectName = p.project_name || p.project;
          try {
            const baseUrl =
              process.env.MC_SERVER_URL || "http://localhost:3000";
            let body: Record<string, string> = {};

            if (projectName && projectName !== "all") {
              const { data: proj } = await sb
                .from("mc_projects")
                .select("id")
                .ilike("name", `%${projectName}%`)
                .single();
              if (!proj) {
                results.push({
                  type: "env_health",
                  ok: false,
                  error: `Project not found: ${projectName}`,
                });
                break;
              }
              body = { project_id: proj.id };
            }

            const res = await fetch(`${baseUrl}/api/env/health`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(30_000),
            });
            const data = await res.json();
            results.push({
              type: "env_health",
              ok: res.ok,
              ...(res.ok ? data : { error: data.error }),
            } as EdActionResult & Record<string, unknown>);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ type: "env_health", ok: false, error: msg });
          }
          break;
        }

        case "query_project": {
          // Query a project's Supabase database
          const p = action.params as Record<string, string>;
          const projectName = p.project_name || p.project;
          const sql = p.sql || p.query;
          if (!projectName || !sql) {
            results.push({
              type: "query_project",
              ok: false,
              error: "project_name and sql are required",
            });
            break;
          }
          // Look up the project's supabase_project_id
          const { data: project } = await sb
            .from("mc_projects")
            .select("name, supabase_project_id")
            .ilike("name", projectName)
            .single();
          if (!project?.supabase_project_id) {
            results.push({
              type: "query_project",
              ok: false,
              error: project
                ? `Project "${project.name}" has no Supabase database linked. Ask David to set supabase_project_id.`
                : `Project "${projectName}" not found.`,
            });
            break;
          }
          // Execute via MC's /api/projects/query endpoint (proxies to project's Supabase)
          try {
            const baseUrl =
              process.env.MC_SERVER_URL || "http://localhost:3000";
            const res = await fetch(`${baseUrl}/api/projects/query`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-runner-token": process.env.MC_RUNNER_TOKEN || "",
              },
              body: JSON.stringify({
                project_id: project.supabase_project_id,
                sql,
              }),
              signal: AbortSignal.timeout(15_000),
            });
            const data = await res.json();
            results.push({
              type: "query_project",
              ok: res.ok,
              project: project.name,
              ...(res.ok ? { data: data.rows } : { error: data.error }),
            } as EdActionResult & Record<string, unknown>);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ type: "query_project", ok: false, error: msg });
          }
          break;
        }

        case "acknowledge_notification": {
          const p = action.params as Record<string, string>;
          if (!p.notification_id) {
            results.push({
              type: "acknowledge_notification",
              ok: false,
              error: "notification_id required",
            });
            break;
          }
          await markAcknowledged(p.notification_id);
          results.push({
            type: "acknowledge_notification",
            id: p.notification_id,
            ok: true,
          });
          break;
        }

        case "create_notification": {
          const p = action.params as Record<string, string>;
          const notif = await createNotification({
            title: p.title || "Reminder from Ed",
            body: p.body || undefined,
            category:
              (p.category as "reminder" | "info" | "alert") || "reminder",
            priority:
              (p.priority as "low" | "normal" | "high" | "urgent") || "normal",
          });
          if (notif) {
            results.push({
              type: "create_notification",
              id: notif.id,
              ok: true,
            });
          } else {
            results.push({
              type: "create_notification",
              ok: false,
              error: "Failed to create notification",
            });
          }
          break;
        }

        case "create_agent": {
          const p = action.params as Record<string, string>;
          // Resolve department name to department_id
          let departmentId: string | null = null;
          if (p.department) {
            const { data: dept } = await sb
              .from("mc_departments")
              .select("id")
              .ilike("name", p.department)
              .single();
            departmentId = dept?.id || null;
          }

          const { data: agent, error } = await sb
            .from("mc_agents")
            .insert({
              name: p.name,
              role: p.role || "researcher",
              department_id: departmentId,
              default_engine: p.default_engine || "claude",
              fallback_engine: p.fallback_engine || "gemini",
              cost_tier: p.cost_tier || "low",
              system_prompt: p.system_prompt || "",
              emoji: p.emoji || "",
              active: true,
            })
            .select("id, name")
            .single();
          if (error) throw error;
          results.push({
            type: "create_agent",
            id: agent.id,
            ok: true,
          });
          break;
        }

        case "update_agent": {
          const p = action.params as Record<string, string>;
          const { data: agent } = await sb
            .from("mc_agents")
            .select("id")
            .ilike("name", p.agent_name || p.name || "")
            .single();
          if (!agent) {
            results.push({
              type: "update_agent",
              ok: false,
              error: "Agent not found",
            });
            break;
          }

          const updates: Record<string, unknown> = {};
          if (p.system_prompt) updates.system_prompt = p.system_prompt;
          if (p.fallback_engine) updates.fallback_engine = p.fallback_engine;
          if (p.default_engine) updates.default_engine = p.default_engine;
          if (p.active !== undefined) updates.active = p.active === "true";
          if (p.emoji) updates.emoji = p.emoji;
          if (p.cost_tier) updates.cost_tier = p.cost_tier;
          if (p.role) updates.role = p.role;

          if (Object.keys(updates).length === 0) {
            results.push({
              type: "update_agent",
              ok: false,
              error: "No fields to update",
            });
            break;
          }

          await sb.from("mc_agents").update(updates).eq("id", agent.id);
          results.push({ type: "update_agent", id: agent.id, ok: true });
          break;
        }

        case "register_skill": {
          const p = action.params as Record<string, string>;
          if (!p.key) {
            results.push({
              type: "register_skill",
              ok: false,
              error: "key is required",
            });
            break;
          }
          const { data: skill, error } = await sb
            .from("mc_skills")
            .upsert(
              {
                key: p.key,
                name: p.name || p.key,
                description: p.description || "",
                skill_type: p.skill_type || "prompt",
                prompt_content: p.prompt_content || null,
                prompt_file_path: p.prompt_file_path || null,
                mcp_server_name: p.mcp_server_name || null,
                usage_guidelines: p.usage_guidelines || null,
              },
              { onConflict: "key" },
            )
            .select("id")
            .single();
          if (error) throw error;
          results.push({
            type: "register_skill",
            id: skill.id,
            ok: true,
          });
          break;
        }

        case "launch_claude": {
          const p = action.params as Record<string, string>;
          // Resolve project
          const { data: proj } = await sb
            .from("mc_projects")
            .select(
              "id, name, repo_path, delivery_plan, description, revenue_target_monthly",
            )
            .ilike("name", p.project_name)
            .single();

          if (!proj) {
            results.push({
              type: "launch_claude",
              ok: false,
              error: `Project "${p.project_name}" not found`,
            });
            break;
          }
          if (!proj.repo_path) {
            results.push({
              type: "launch_claude",
              ok: false,
              error: `No repo_path for ${proj.name}`,
            });
            break;
          }

          // Build spec-aware prompt with delivery_plan context
          const dp =
            (proj.delivery_plan as Record<string, unknown> | null) || {};
          const milestones = (dp.milestones as Record<string, unknown>[]) || [];
          const activeMilestone = milestones.find(
            (m) => m.status !== "done",
          ) as Record<string, unknown> | undefined;
          const specLines: string[] = [];
          if (dp.overview) specLines.push(`Overview: ${dp.overview as string}`);
          if (
            Array.isArray(dp.tech_stack) &&
            (dp.tech_stack as string[]).length
          )
            specLines.push(
              `Tech Stack: ${(dp.tech_stack as string[]).join(", ")}`,
            );
          if (dp.current_status)
            specLines.push(`Current Status: ${dp.current_status as string}`);
          if (
            Array.isArray(dp.key_blockers) &&
            (dp.key_blockers as string[]).length
          )
            specLines.push(
              `Blockers: ${(dp.key_blockers as string[]).join("; ")}`,
            );
          if (activeMilestone) {
            specLines.push(
              `\nActive Milestone: ${activeMilestone.name as string} [${activeMilestone.status as string}]`,
            );
            const ac = activeMilestone.acceptance_criteria;
            if (Array.isArray(ac) && ac.length) {
              specLines.push("Acceptance Criteria:");
              for (const item of ac as string[])
                specLines.push(`- [ ] ${item}`);
            }
          }
          const evalBlock: string[] = [];
          const evaluation = dp.evaluation as
            | Record<string, unknown>
            | undefined;
          if (evaluation?.build_must_pass)
            evalBlock.push("Build MUST pass before committing.");
          if (evaluation?.test_command)
            evalBlock.push(`Run tests: ${evaluation.test_command as string}`);
          if (evaluation?.verify_url)
            evalBlock.push(`Verify at: ${evaluation.verify_url as string}`);

          const promptText = [
            `You are working on the project "${proj.name}".`,
            `Repo path: ${proj.repo_path}`,
            proj.description ? `Description: ${proj.description}` : "",
            proj.revenue_target_monthly
              ? `Revenue target: £${proj.revenue_target_monthly}/month`
              : "",
            "",
            ...specLines,
            "",
            `## Task`,
            p.task,
            "",
            `## Working Instructions`,
            "Work in the project repo. Make changes, run tests, and commit when done.",
            ...evalBlock,
            "If you encounter issues, document them clearly.",
          ]
            .filter(Boolean)
            .join("\n");

          const { data: launchJob, error } = await sb
            .from("mc_jobs")
            .insert({
              title: `[${proj.name}] ${p.task.slice(0, 100)}`,
              prompt_text: promptText,
              engine: "claude",
              status: "queued",
              priority: Number(p.priority) || 3,
              job_type: "task",
              source: "dashboard",
              project_id: proj.id,
              repo_path: proj.repo_path,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({
            type: "launch_claude",
            job_id: launchJob.id,
            ok: true,
          });
          break;
        }

        case "create_job": {
          // Alias for spawn_job with project_name resolution — matches Telegram's create_job
          const p = action.params as Record<string, string>;
          let projectId: string | null = null;
          let repoPath =
            p.repo_path || "/Users/david/.openclaw/workspace/mission-control";
          if (p.project_name) {
            const { data: proj } = await sb
              .from("mc_projects")
              .select("id, repo_path")
              .ilike("name", p.project_name)
              .single();
            if (proj) {
              projectId = proj.id;
              if (proj.repo_path) repoPath = proj.repo_path;
            }
          }

          let agentId: string | null = null;
          if (p.agent_name) {
            const { data: agent } = await sb
              .from("mc_agents")
              .select("id")
              .ilike("name", p.agent_name)
              .single();
            if (agent) agentId = agent.id;
          }

          const { data: job, error } = await sb
            .from("mc_jobs")
            .insert({
              title: p.title,
              prompt_text: p.prompt_text || p.title,
              repo_path: repoPath,
              engine: p.engine || "claude",
              status: "queued",
              priority: Number(p.priority) || 3,
              job_type: p.job_type || "task",
              source: "dashboard",
              project_id: projectId,
              agent_id: agentId,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({
            type: "create_job",
            job_id: job.id,
            ok: true,
          });
          break;
        }

        default:
          results.push({
            type: action.type,
            ok: false,
            error: `Unknown action: ${action.type}`,
          });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ type: action.type, ok: false, error: message });
    }
  }

  return results;
}
