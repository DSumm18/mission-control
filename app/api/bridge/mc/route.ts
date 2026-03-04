/**
 * POST /api/bridge/mc
 * Bridge API for Jarvis (OpenClaw) to manage MC resources.
 *
 * Actions: list_agents, list_jobs, create_job, update_job,
 *          list_tasks, create_task, update_task, system_health
 *
 * Localhost-only — no auth required (same as bridge/status).
 */

export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";

type BridgeAction =
  | "list_agents"
  | "list_jobs"
  | "create_job"
  | "update_job"
  | "list_tasks"
  | "create_task"
  | "update_task"
  | "system_health";

interface BridgeRequest {
  action: BridgeAction;
  params?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  let body: BridgeRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, params = {} } = body;
  if (!action) {
    return Response.json({ error: "action is required" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  try {
    switch (action) {
      case "list_agents": {
        const { data, error } = await sb
          .from("mc_agents")
          .select(
            "id, name, status, role, department, active, consecutive_failures, fallback_engine, default_engine",
          )
          .order("name");
        if (error) throw error;
        return Response.json({ ok: true, agents: data });
      }

      case "list_jobs": {
        const limit = (params.limit as number) || 20;
        const status = params.status as string | undefined;
        let query = sb
          .from("mc_jobs")
          .select(
            "id, title, status, engine, engine_used, agent_id, result, quality_score, created_at, completed_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return Response.json({ ok: true, jobs: data });
      }

      case "create_job": {
        const title = params.title as string;
        const prompt_text = params.prompt_text as string;
        if (!title || !prompt_text) {
          return Response.json(
            { error: "title and prompt_text are required" },
            { status: 400 },
          );
        }
        const { data, error } = await sb
          .from("mc_jobs")
          .insert({
            title,
            prompt_text,
            engine: (params.engine as string) || "claude",
            agent_id: (params.agent_id as string) || null,
            status: "queued",
            repo_path: (params.repo_path as string) || null,
          })
          .select("id, title, status")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, job: data });
      }

      case "update_job": {
        const jobId = params.id as string;
        if (!jobId) {
          return Response.json({ error: "id is required" }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (params.status) updates.status = params.status;
        if (params.result) updates.result = params.result;
        if (params.quality_score) updates.quality_score = params.quality_score;
        if (params.status === "done" || params.status === "failed") {
          updates.completed_at = new Date().toISOString();
        }

        const { data, error } = await sb
          .from("mc_jobs")
          .update(updates)
          .eq("id", jobId)
          .select("id, title, status")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, job: data });
      }

      case "list_tasks": {
        const status = params.status as string | undefined;
        let query = sb
          .from("mc_tasks")
          .select(
            "id, title, status, priority, task_type, assigned_to, created_at",
          )
          .order("priority", { ascending: true })
          .limit((params.limit as number) || 20);

        if (status) {
          query = query.eq("status", status);
        } else {
          query = query.in("status", ["todo", "in_progress"]);
        }

        const { data, error } = await query;
        if (error) throw error;
        return Response.json({ ok: true, tasks: data });
      }

      case "create_task": {
        const title = params.title as string;
        if (!title) {
          return Response.json({ error: "title is required" }, { status: 400 });
        }
        const { data, error } = await sb
          .from("mc_tasks")
          .insert({
            title,
            status: "todo",
            priority: (params.priority as number) || 3,
            task_type: (params.task_type as string) || "task",
            assigned_to: (params.assigned_to as string) || null,
            description: (params.description as string) || null,
          })
          .select("id, title, status")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, task: data });
      }

      case "update_task": {
        const taskId = params.id as string;
        if (!taskId) {
          return Response.json({ error: "id is required" }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (params.status) updates.status = params.status;
        if (params.priority) updates.priority = params.priority;
        if (params.assigned_to !== undefined)
          updates.assigned_to = params.assigned_to;
        if (params.title) updates.title = params.title;

        const { data, error } = await sb
          .from("mc_tasks")
          .update(updates)
          .eq("id", taskId)
          .select("id, title, status")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, task: data });
      }

      case "system_health": {
        const [jobs, agents, tasks, notifications] = await Promise.all([
          sb
            .from("mc_jobs")
            .select("id, status")
            .in("status", ["queued", "running"]),
          sb
            .from("mc_agents")
            .select("id, name, active, consecutive_failures, status"),
          sb
            .from("mc_tasks")
            .select("id")
            .in("status", ["todo", "in_progress"]),
          sb
            .from("mc_ed_notifications")
            .select("id")
            .in("status", ["pending", "delivered"]),
        ]);

        const agentList = agents.data || [];
        const activeAgents = agentList.filter((a) => a.active);
        const unhealthyAgents = agentList.filter(
          (a) => (a.consecutive_failures || 0) >= 3,
        );

        return Response.json({
          ok: true,
          health: {
            jobs_queued: (jobs.data || []).filter((j) => j.status === "queued")
              .length,
            jobs_running: (jobs.data || []).filter(
              (j) => j.status === "running",
            ).length,
            agents_total: agentList.length,
            agents_active: activeAgents.length,
            agents_unhealthy: unhealthyAgents.map((a) => ({
              name: a.name,
              failures: a.consecutive_failures,
            })),
            tasks_open: tasks.data?.length || 0,
            notifications_pending: notifications.data?.length || 0,
          },
        });
      }

      default:
        return Response.json(
          {
            error: `Unknown action: ${action}`,
            valid_actions: [
              "list_agents",
              "list_jobs",
              "create_job",
              "update_job",
              "list_tasks",
              "create_task",
              "update_task",
              "system_health",
            ],
          },
          { status: 400 },
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
