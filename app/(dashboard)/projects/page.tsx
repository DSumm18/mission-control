'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  delivery_plan: Record<string, unknown>;
  status: string;
  revenue_target_monthly: number | null;
  mc_agents: { id: string; name: string; avatar_emoji: string | null } | null;
  active_jobs: number;
  done_jobs: number;
  created_at: string;
};

function statusBadge(status: string) {
  if (status === 'active') return 'good';
  if (status === 'paused') return 'warn';
  return 'bad';
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch('/api/projects', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []));
  }, []);

  return (
    <div>
      <h1 className="page-title">Projects</h1>
      <p className="page-sub">Portfolio view with delivery plans, revenue targets, and PM assignments.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {projects.map((p) => {
          const milestones = (p.delivery_plan as { milestones?: { name: string; target: string; status: string }[] })?.milestones || [];
          const doneMilestones = milestones.filter((m) => m.status === 'done').length;
          const progressPct = milestones.length > 0 ? Math.round((doneMilestones / milestones.length) * 100) : 0;

          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card" style={{ height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{p.name}</h3>
                  <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>
                </div>

                {p.description && (
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{p.description}</div>
                )}

                {/* PM Agent */}
                {p.mc_agents && (
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    PM: {p.mc_agents.avatar_emoji || '🤖'} {p.mc_agents.name}
                  </div>
                )}

                {/* Revenue target */}
                {p.revenue_target_monthly && (
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    Target: <strong>£{p.revenue_target_monthly.toLocaleString()}/mo</strong>
                  </div>
                )}

                {/* Milestone progress */}
                {milestones.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      Milestones: {doneMilestones}/{milestones.length} ({progressPct}%)
                    </div>
                    <div style={{
                      background: 'var(--line)',
                      borderRadius: 4,
                      height: 6,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        background: 'var(--good)',
                        height: '100%',
                        width: `${progressPct}%`,
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )}

                {/* Job stats */}
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {p.active_jobs} active jobs &bull; {p.done_jobs} completed
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
