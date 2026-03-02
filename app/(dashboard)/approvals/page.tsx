"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastContext";

type QueueItem = {
  id: string;
  type: "deliverable" | "decision" | "job" | "task";
  title: string;
  subtitle: string | null;
  status: string;
  priority: number;
  created_at: string;
  link: string;
  meta?: Record<string, unknown>;
};

type Counts = {
  deliverables: number;
  decisions: number;
  jobs: number;
  tasks: number;
  total: number;
};

type Filter = "all" | "deliverable" | "decision" | "job" | "task";

function typeBadge(type: string) {
  switch (type) {
    case "deliverable":
      return { label: "Deliverable", color: "#7c3aed" };
    case "decision":
      return { label: "Decision", color: "#0ea5e9" };
    case "job":
      return { label: "Job", color: "#f59e0b" };
    case "task":
      return { label: "Task", color: "#10b981" };
    default:
      return { label: type, color: "#6b7280" };
  }
}

function priorityLabel(p: number) {
  if (p <= 1) return { label: "Urgent", color: "var(--bad)" };
  if (p <= 2) return { label: "High", color: "var(--warn)" };
  return { label: "Normal", color: "var(--muted)" };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Counts>({
    deliverables: 0,
    decisions: 0,
    jobs: 0,
    tasks: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/approval-queue", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setCounts(
          d.counts || {
            deliverables: 0,
            decisions: 0,
            jobs: 0,
            tasks: 0,
            total: 0,
          },
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered =
    filter === "all" ? items : items.filter((i) => i.type === filter);

  async function approveDeliverable(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast(d.error || "Failed", "bad");
        return;
      }
      toast("Approved", "good");
      load();
    } finally {
      setActing(null);
    }
  }

  async function rejectDeliverable(id: string) {
    const feedback = prompt("Rejection feedback:");
    if (!feedback) return;
    setActing(id);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", feedback }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast(d.error || "Failed", "bad");
        return;
      }
      toast("Rejected with feedback", "warn");
      load();
    } finally {
      setActing(null);
    }
  }

  async function requeueJob(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "queued" }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast(d.error || "Failed", "bad");
        return;
      }
      toast("Re-queued", "good");
      load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Approval Queue</h1>
      <p className="page-sub">
        Everything needing your attention in one place.
      </p>

      {/* Summary KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {(
          [
            ["Total", counts.total, "all"],
            ["Deliverables", counts.deliverables, "deliverable"],
            ["Decisions", counts.decisions, "decision"],
            ["Failed Jobs", counts.jobs, "job"],
            ["Tasks", counts.tasks, "task"],
          ] as [string, number, Filter][]
        ).map(([label, count, f]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="card"
            style={{
              cursor: "pointer",
              textAlign: "center",
              padding: "12px 8px",
              border:
                filter === f
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              transition: "border-color 0.15s",
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: count > 0 ? "var(--fg)" : "var(--muted)",
              }}
            >
              {count}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {label}
            </div>
          </button>
        ))}
      </div>

      {/* Queue items */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>&#x2705;</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>All clear</div>
          <div className="muted">
            {filter === "all"
              ? "Nothing needs your attention right now."
              : `No ${filter} items pending.`}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((item) => {
            const tb = typeBadge(item.type);
            const pl = priorityLabel(item.priority);
            const isActing = acting === item.id;

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: tb.color,
                        color: "#fff",
                      }}
                    >
                      {tb.label}
                    </span>
                    {item.priority <= 2 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: pl.color,
                        }}
                      >
                        {pl.label}
                      </span>
                    )}
                    <span className="muted" style={{ fontSize: 11 }}>
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    <Link
                      href={item.link}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {item.title}
                    </Link>
                  </div>
                  {item.subtitle && (
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {item.subtitle}
                    </div>
                  )}
                </div>

                {/* Action buttons based on type */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {item.type === "deliverable" && (
                    <>
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => approveDeliverable(item.id)}
                        disabled={isActing}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-sm"
                        onClick={() => rejectDeliverable(item.id)}
                        disabled={isActing}
                      >
                        Reject
                      </button>
                      <Link href={item.link} className="btn-sm">
                        View
                      </Link>
                    </>
                  )}
                  {item.type === "decision" && (
                    <Link href={item.link} className="btn-sm btn-primary">
                      Review
                    </Link>
                  )}
                  {item.type === "job" && (
                    <>
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => requeueJob(item.id)}
                        disabled={isActing}
                      >
                        Re-run
                      </button>
                      <Link href={item.link} className="btn-sm">
                        View
                      </Link>
                    </>
                  )}
                  {item.type === "task" && (
                    <Link href={item.link} className="btn-sm btn-primary">
                      View
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
