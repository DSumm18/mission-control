'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageInfo from '@/components/ui/PageInfo';

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

  const activeProjects = projects.filter(p => p.status === 'active');
  const totalRevTarget = activeProjects.reduce((s, p) => s + (p.revenue_target_monthly || 0), 0);
  const totalActiveJobs = projects.reduce((s, p) => s + (p.active_jobs || 0), 0);
  const totalDoneJobs = projects.reduce((s, p) => s + (p.done_jobs || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Projects</h1>
        <PageInfo title="Projects" description="Your product portfolio. Each project tracks revenue targets, delivery milestones, assigned agents, and overall progress." features={["Revenue targets and milestone progress at a glance", "Click a project for the full command center", "Launch Claude Code sessions directly from projects", "Track costs and job history per project"]} />
      </div>
      <p className="page-sub">Portfolio view with delivery plans, revenue targets, and PM assignments.</p>

      {/* Business Summary */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Revenue Target</div>
          <div className="kpi">{totalRevTarget > 0 ? `£${totalRevTarget.toLocaleString()}` : '—'}</div>
          <div className="muted">per month (active)</div>
        </article>
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Active Projects</div>
          <div className="kpi">{activeProjects.length}</div>
        </article>
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Active Jobs</div>
          <div className="kpi">{totalActiveJobs}</div>
        </article>
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Completed Jobs</div>
          <div className="kpi">{totalDoneJobs}</div>
        </article>
      </section>

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
