/**
 * POST /api/bridge/mc
 * Bridge API for Jarvis (OpenClaw) to manage MC resources.
 *
 * Actions: list_agents, list_jobs, create_job, update_job,
 *          list_tasks, create_task, update_task, system_health,
 *          query (read any mc_* table), mutate (write any mc_* table),
 *          update_agent, create_agent, update_setting, upsert_skill, assign_skill
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
  | "system_health"
  | "query"
  | "update_agent"
  | "create_agent"
  | "update_setting"
  | "upsert_skill"
  | "assign_skill"
  | "mutate";

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

      case "update_agent": {
        const agentId = params.id as string;
        const agentName = params.name as string;
        if (!agentId && !agentName) {
          return Response.json(
            { error: "id or name is required" },
            { status: 400 },
          );
        }

        const updates: Record<string, unknown> = {};
        const AGENT_FIELDS = [
          "role",
          "department",
          "status",
          "active",
          "system_prompt",
          "default_engine",
          "fallback_engine",
          "cost_tier",
          "emoji",
          "consecutive_failures",
        ];
        for (const field of AGENT_FIELDS) {
          if (params[field] !== undefined) updates[field] = params[field];
        }

        let query = sb.from("mc_agents").update(updates);
        if (agentId) {
          query = query.eq("id", agentId);
        } else {
          query = query.eq("name", agentName);
        }

        const { data, error } = await query
          .select("id, name, role, status, active")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, agent: data });
      }

      case "create_agent": {
        const name = params.name as string;
        if (!name) {
          return Response.json({ error: "name is required" }, { status: 400 });
        }
        const { data, error } = await sb
          .from("mc_agents")
          .insert({
            name,
            role: (params.role as string) || "specialist",
            department: (params.department as string) || "operations",
            status: "active",
            active: true,
            default_engine: (params.default_engine as string) || "claude",
            fallback_engine: (params.fallback_engine as string) || "gemini",
            cost_tier: (params.cost_tier as string) || "low",
            system_prompt: (params.system_prompt as string) || "",
            emoji: (params.emoji as string) || "",
          })
          .select("id, name, role, status")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, agent: data });
      }

      case "update_setting": {
        const key = params.key as string;
        if (!key) {
          return Response.json({ error: "key is required" }, { status: 400 });
        }
        const { data, error } = await sb
          .from("mc_settings")
          .upsert({ key, value: params.value }, { onConflict: "key" })
          .select("key, value")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, setting: data });
      }

      case "upsert_skill": {
        const key = params.key as string;
        if (!key) {
          return Response.json({ error: "key is required" }, { status: 400 });
        }
        const { data, error } = await sb
          .from("mc_skills")
          .upsert(
            {
              key,
              name: (params.name as string) || key,
              description: (params.description as string) || "",
              skill_type: (params.skill_type as string) || "prompt",
              status: (params.status as string) || "active",
              content: (params.content as string) || "",
            },
            { onConflict: "key" },
          )
          .select("id, key, name, status")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, skill: data });
      }

      case "assign_skill": {
        const agent_id = params.agent_id as string;
        const skill_id = params.skill_id as string;
        if (!agent_id || !skill_id) {
          return Response.json(
            { error: "agent_id and skill_id are required" },
            { status: 400 },
          );
        }
        const { data, error } = await sb
          .from("mc_agent_skills")
          .upsert({ agent_id, skill_id }, { onConflict: "agent_id,skill_id" })
          .select("agent_id, skill_id")
          .single();
        if (error) throw error;
        return Response.json({ ok: true, assignment: data });
      }

      case "mutate": {
        // Generic write for any allowed table — insert, update, upsert, delete
        const table = params.table as string;
        const op = params.operation as
          | "insert"
          | "update"
          | "upsert"
          | "delete";
        if (!table || !op) {
          return Response.json(
            { error: "table and operation are required" },
            { status: 400 },
          );
        }

        const WRITABLE_TABLES = [
          "mc_agents",
          "mc_agent_skills",
          "mc_jobs",
          "mc_tasks",
          "mc_projects",
          "mc_project_deliverables",
          "mc_research_items",
          "mc_newsletters",
          "mc_challenge_board",
          "mc_challenge_responses",
          "mc_ed_notifications",
          "mc_settings",
          "mc_skills",
        ];

        if (!WRITABLE_TABLES.includes(table)) {
          return Response.json(
            {
              error: `Table not writable. Valid: ${WRITABLE_TABLES.join(", ")}`,
            },
            { status: 400 },
          );
        }

        const record = params.record as Record<string, unknown>;
        const filters = params.filters as Record<string, unknown> | undefined;

        if (op === "insert") {
          if (!record)
            return Response.json(
              { error: "record is required" },
              { status: 400 },
            );
          const { data, error } = await sb
            .from(table)
            .insert(record)
            .select()
            .single();
          if (error) throw error;
          return Response.json({ ok: true, row: data });
        }

        if (op === "update") {
          if (!record || !filters)
            return Response.json(
              { error: "record and filters required" },
              { status: 400 },
            );
          let query = sb.from(table).update(record);
          for (const [k, v] of Object.entries(filters)) {
            query = query.eq(k, v as string);
          }
          const { data, error } = await query.select();
          if (error) throw error;
          return Response.json({ ok: true, rows: data });
        }

        if (op === "upsert") {
          if (!record)
            return Response.json(
              { error: "record is required" },
              { status: 400 },
            );
          const onConflict = params.on_conflict as string | undefined;
          const { data, error } = await sb
            .from(table)
            .upsert(record, onConflict ? { onConflict } : undefined)
            .select()
            .single();
          if (error) throw error;
          return Response.json({ ok: true, row: data });
        }

        if (op === "delete") {
          if (!filters)
            return Response.json(
              { error: "filters required for delete" },
              { status: 400 },
            );
          let query = sb.from(table).delete();
          for (const [k, v] of Object.entries(filters)) {
            query = query.eq(k, v as string);
          }
          const { data, error } = await query.select();
          if (error) throw error;
          return Response.json({ ok: true, deleted: data?.length || 0 });
        }

        return Response.json(
          { error: `Invalid operation: ${op}` },
          { status: 400 },
        );
      }

      case "query": {
        const table = params.table as string;
        if (!table) {
          return Response.json({ error: "table is required" }, { status: 400 });
        }

        // Allowlist of MC tables Jarvis can read
        const ALLOWED_TABLES = [
          "mc_agents",
          "mc_agent_skills",
          "mc_jobs",
          "mc_tasks",
          "mc_projects",
          "mc_project_deliverables",
          "mc_research_items",
          "mc_newsletters",
          "mc_challenge_board",
          "mc_challenge_responses",
          "mc_ed_messages",
          "mc_ed_conversations",
          "mc_ed_notifications",
          "mc_runs",
          "mc_settings",
          "mc_skills",
          "mc_token_usage",
          "mc_env_health",
        ];

        if (!ALLOWED_TABLES.includes(table)) {
          return Response.json(
            { error: `Table not allowed. Valid: ${ALLOWED_TABLES.join(", ")}` },
            { status: 400 },
          );
        }

        const select = (params.select as string) || "*";
        const limit = (params.limit as number) || 50;
        const orderBy = params.order_by as string | undefined;
        const ascending = (params.ascending as boolean) ?? false;
        const filters = (params.filters as Record<string, unknown>) || {};

        let query = sb.from(table).select(select).limit(limit);

        if (orderBy) {
          query = query.order(orderBy, { ascending });
        }

        // Apply simple eq filters
        for (const [key, value] of Object.entries(filters)) {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            query = query.eq(key, value);
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        return Response.json({
          ok: true,
          table,
          count: data?.length || 0,
          rows: data,
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
              "query",
              "update_agent",
              "create_agent",
              "update_setting",
              "upsert_skill",
              "assign_skill",
              "mutate",
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
