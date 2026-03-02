import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/approval-queue
 * Unified inbox: everything needing David's attention in one place.
 * Returns items sorted by priority then date (newest first).
 */
export async function GET() {
  const sb = supabaseAdmin();
  const items: {
    id: string;
    type: "deliverable" | "decision" | "job" | "task";
    title: string;
    subtitle: string | null;
    status: string;
    priority: number; // 1=urgent, 2=high, 3=normal
    created_at: string;
    link: string;
    meta?: Record<string, unknown>;
  }[] = [];

  // 1. Deliverables awaiting review (status = 'review')
  const { data: deliverables } = await sb
    .from("mc_project_deliverables")
    .select(
      "id, title, deliverable_type, status, created_at, project_id, mc_projects(name)",
    )
    .eq("status", "review")
    .order("created_at", { ascending: false });

  for (const d of deliverables || []) {
    const project = d.mc_projects as unknown as { name: string } | null;
    items.push({
      id: d.id,
      type: "deliverable",
      title: d.title,
      subtitle: project?.name
        ? `${d.deliverable_type.toUpperCase()} — ${project.name}`
        : d.deliverable_type.toUpperCase(),
      status: "review",
      priority: 2,
      created_at: d.created_at,
      link: `/projects/${d.project_id}`,
      meta: { deliverable_type: d.deliverable_type, project_id: d.project_id },
    });
  }

  // 2. Challenge boards ready for decision (status = 'open')
  const { data: boards } = await sb
    .from("mc_challenge_board")
    .select(
      "id, decision_title, decision_context, status, created_at, mc_challenge_responses(id)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  for (const b of boards || []) {
    const responseCount =
      (b.mc_challenge_responses as unknown as { id: string }[])?.length || 0;
    items.push({
      id: b.id,
      type: "decision",
      title: b.decision_title,
      subtitle: `${responseCount} executive responses`,
      status: "open",
      priority: 2,
      created_at: b.created_at,
      link: "/decisions",
      meta: { response_count: responseCount },
    });
  }

  // 3. Failed/rejected jobs that need attention
  const { data: failedJobs } = await sb
    .from("mc_jobs")
    .select("id, title, status, created_at, retry_count, mc_agents(name)")
    .in("status", ["failed", "rejected"])
    .order("created_at", { ascending: false })
    .limit(20);

  for (const j of failedJobs || []) {
    const agent = j.mc_agents as unknown as { name: string } | null;
    items.push({
      id: j.id,
      type: "job",
      title: j.title,
      subtitle: agent?.name ? `${j.status} — ${agent.name}` : j.status,
      status: j.status,
      priority: j.status === "failed" ? 2 : 3,
      created_at: j.created_at,
      link: `/jobs/${j.id}`,
      meta: { retry_count: j.retry_count },
    });
  }

  // 4. Tasks assigned to David
  const { data: tasks } = await sb
    .from("mc_tasks")
    .select("id, title, status, priority, task_type, created_at")
    .eq("assigned_to", "david")
    .in("status", ["todo", "in_progress"])
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  for (const t of tasks || []) {
    items.push({
      id: t.id,
      type: "task",
      title: t.title,
      subtitle: t.task_type || "task",
      status: t.status,
      priority: t.priority <= 3 ? 1 : t.priority <= 5 ? 2 : 3,
      created_at: t.created_at,
      link: "/tasks",
      meta: { task_type: t.task_type },
    });
  }

  // Sort: priority asc (1=urgent first), then newest first
  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json({
    items,
    counts: {
      deliverables: (deliverables || []).length,
      decisions: (boards || []).length,
      jobs: (failedJobs || []).length,
      tasks: (tasks || []).length,
      total: items.length,
    },
  });
}
