'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  DollarSign, Briefcase, Users, Star,
  AlertTriangle, CheckCircle, Clock, FolderOpen,
} from 'lucide-react';
import AnimatedKPI from '@/components/ui/AnimatedKPI';
import { SkeletonKPI, SkeletonCard } from '@/components/ui/Skeleton';
import SystemVitals from '@/components/ui/SystemVitals';

type Overview = {
  total_revenue_target: number;
  active_jobs: number;
  active_agents: number;
  total_agents: number;
  avg_quality_7d: number | null;
  projects_active: number;
  tasks_todo: number;
};

type DailyStats = {
  date: string;
  done: number;
  failed: number;
  reviewing: number;
  running: number;
  queued: number;
};

type CostRow = {
  engine: string;
  runs: number;
  est_cost_usd: number;
};

type TaskRow = {
  id: string;
  title: string;
  priority: number;
  status: string;
  due_date: string | null;
  mc_projects: { name: string } | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  revenue_target_monthly: number | null;
  active_jobs: number;
  done_jobs: number;
};

type AlertAgent = {
  id: string;
  name: string;
  avatar_emoji: string | null;
  consecutive_failures: number;
  quality_score_avg: number;
};

type FeedItem = {
  id: string;
  title: string;
  status: string;
  completed_at: string;
  job_type: string;
  quality_score: number | null;
};

const PIE_COLORS = ['#6ea8fe', '#3ddc97', '#f7c948', '#ff6b6b', '#c084fc'];
const POLL_MS = 30_000;

function priorityBadge(p: number) {
  if (p <= 2) return 'bad';
  if (p <= 5) return 'warn';
  return 'good';
}

export default function HomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [daily, setDaily] = useState<DailyStats[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [alerts, setAlerts] = useState<AlertAgent[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const fetchAll = useCallback(() => {
    const opts = { cache: 'no-store' as const };
    fetch('/api/stats/overview', opts).then(r => r.json()).then(d => setOverview(d)).catch(() => {});
    fetch('/api/stats/jobs-daily', opts).then(r => r.json()).then(d => setDaily(d.daily || [])).catch(() => {});
    fetch('/api/costs', opts).then(r => r.json()).then(d => setCosts(d.costs || [])).catch(() => {});
    fetch('/api/tasks?status=todo&limit=3', opts).then(r => r.json()).then(d => setTasks(d.tasks || [])).catch(() => {});
    fetch('/api/projects', opts).then(r => r.json()).then(d => setProjects((d.projects || []).slice(0, 3))).catch(() => {});
    fetch('/api/agents', opts).then(r => r.json()).then(d => {
      const flagged = (d.agents || []).filter((a: AlertAgent) =>
        a.consecutive_failures > 0 || (a.quality_score_avg > 0 && a.quality_score_avg < 25)
      );
      setAlerts(flagged);
    }).catch(() => {});
    fetch('/api/jobs/pipeline', opts).then(r => r.json()).then(d => {
      const recent = (d.jobs || [])
        .filter((j: FeedItem) => j.completed_at)
        .sort((a: FeedItem, b: FeedItem) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
        .slice(0, 10);
      setFeed(recent);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const pieData = useMemo(() =>
    costs.filter(c => c.est_cost_usd > 0).map(c => ({ name: c.engine, value: Number(c.est_cost_usd) })),
    [costs]
  );

  return (
    <div>
      <h1 className="page-title">Mission Control</h1>
      <p className="page-sub">Business command center — agents, projects, quality, and costs at a glance.</p>

      {/* Row 1: KPIs */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={18} color="var(--accent)" />
            <span className="muted">Revenue Target</span>
          </div>
          <div className="kpi">
            {overview ? (
              <AnimatedKPI value={Math.round(overview.total_revenue_target)} prefix="\u00A3" />
            ) : (
              <SkeletonKPI />
            )}
          </div>
          <div className="muted">per month</div>
        </article>
        <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={18} color="var(--accent)" />
            <span className="muted">Active Jobs</span>
            {overview && overview.active_jobs > 0 && (
              <span className="status-dot status-dot-live" />
            )}
          </div>
          <div className="kpi">
            {overview ? (
              <AnimatedKPI value={overview.active_jobs} />
            ) : (
              <SkeletonKPI />
            )}
          </div>
          <div className="muted">running / queued / assigned</div>
        </article>
        <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--accent)" />
            <span className="muted">Agent Utilization</span>
          </div>
          <div className="kpi">
            {overview ? (
              <>{overview.active_agents}/{overview.total_agents}</>
            ) : (
              <SkeletonKPI />
            )}
          </div>
          <div className="muted">agents with running jobs</div>
        </article>
        <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={18} color="var(--accent)" />
            <span className="muted">Quality (7d)</span>
          </div>
          <div className="kpi">
            {overview ? (
              overview.avg_quality_7d ? (
                <AnimatedKPI value={Math.round(overview.avg_quality_7d)} suffix="/50" />
              ) : (
                '\u2014'
              )
            ) : (
              <SkeletonKPI />
            )}
          </div>
          <div className="muted">average review score</div>
        </article>
      </section>

      {/* Row 2: Charts */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card card-animated" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Jobs by Status (7 days)</h3>
          {daily.length > 0 ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} barCategoryGap="20%">
                  <XAxis dataKey="date" tick={{ fill: '#9fb0d9', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#9fb0d9', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a2440', border: '1px solid #2a3559', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#eef3ff' }}
                  />
                  <Bar dataKey="done" stackId="a" fill="#3ddc97" radius={[0,0,0,0]} />
                  <Bar dataKey="reviewing" stackId="a" fill="#f7c948" />
                  <Bar dataKey="failed" stackId="a" fill="#ff6b6b" />
                  <Bar dataKey="running" stackId="a" fill="#6ea8fe" />
                  <Bar dataKey="queued" stackId="a" fill="#2a3559" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <SkeletonCard height={200} />
          )}
        </article>
        <article className="card card-animated" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Cost by Engine (7d)</h3>
          <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a2440', border: '1px solid #2a3559', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Cost']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="muted" style={{ textAlign: 'center', padding: 40 }}>No cost data yet</div>
            )}
          </div>
          {pieData.length > 0 && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12 }}>
              {pieData.map((d, i) => (
                <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}: ${d.value.toFixed(4)}
                </span>
              ))}
            </div>
          )}
        </article>
      </section>

      {/* Row 3: Tasks, Projects, Alerts */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card card-animated" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={16} color="var(--accent)" /> My Tasks
            </h3>
            <Link href="/tasks" style={{ fontSize: 12 }}>View All</Link>
          </div>
          {tasks.length === 0 ? (
            <div className="muted" style={{ padding: 16, textAlign: 'center' }}>No tasks yet</div>
          ) : tasks.map(t => (
            <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{t.title}</span>
                <span className={`badge ${priorityBadge(t.priority)}`}>P{t.priority}</span>
              </div>
              {t.mc_projects && <div className="muted" style={{ fontSize: 11 }}>{t.mc_projects.name}</div>}
              {t.due_date && <div className="muted" style={{ fontSize: 11 }}>Due: {t.due_date}</div>}
            </div>
          ))}
        </article>

        <article className="card card-animated" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FolderOpen size={16} color="var(--accent)" /> Active Projects
            </h3>
            <Link href="/projects" style={{ fontSize: 12 }}>View All</Link>
          </div>
          {projects.length === 0 ? (
            <div className="muted" style={{ padding: 16, textAlign: 'center' }}>No projects</div>
          ) : projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'inherit', textDecoration: 'none', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span className={`badge ${p.status === 'active' ? 'good' : 'warn'}`}>{p.status}</span>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                {p.revenue_target_monthly ? `\u00A3${p.revenue_target_monthly.toLocaleString()}/mo` : '\u2014'}
                {' \u00B7 '}{p.active_jobs} active \u00B7 {p.done_jobs} done
              </div>
            </Link>
          ))}
        </article>

        <article className="card card-animated" style={{ gridColumn: 'span 4' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} color="var(--warn)" /> Agent Alerts
          </h3>
          {alerts.length === 0 ? (
            <div className="muted" style={{ padding: 16, textAlign: 'center' }}>All agents healthy</div>
          ) : alerts.map(a => (
            <Link key={a.id} href={`/agents/${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'inherit', textDecoration: 'none', fontSize: 13 }}>
              <span style={{ fontSize: 18 }}>{a.avatar_emoji || '\uD83E\uDD16'}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{a.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {a.consecutive_failures > 0 && <span className="badge bad" style={{ marginRight: 4 }}>{a.consecutive_failures} failures</span>}
                  {a.quality_score_avg > 0 && a.quality_score_avg < 25 && <span className="badge warn">QA: {a.quality_score_avg}</span>}
                </div>
              </div>
            </Link>
          ))}
        </article>
      </section>

      {/* Row 4: System Vitals */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card card-animated" style={{ gridColumn: 'span 12' }}>
          <h3 style={{ marginTop: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            Mac Mini Vitals
            <span className="status-dot status-dot-live" />
          </h3>
          <SystemVitals />
        </article>
      </section>

      {/* Row 5: Activity Feed */}
      <section className="card card-animated">
        <h3 style={{ marginTop: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} color="var(--accent)" /> Recent Activity
        </h3>
        {feed.length === 0 ? (
          <div className="muted" style={{ padding: 16, textAlign: 'center' }}>No recent activity</div>
        ) : feed.map(f => (
          <div key={f.id} className="feed-item">
            <div className="feed-dot" style={{
              background: f.status === 'done' ? 'var(--good)' : f.status === 'failed' ? 'var(--bad)' : f.status === 'reviewing' ? 'var(--warn)' : 'var(--accent)'
            }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 500 }}>{f.title}</span>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                <span className={`badge ${f.status === 'done' ? 'good' : f.status === 'failed' ? 'bad' : 'warn'}`}>{f.status}</span>
                {f.quality_score !== null && (
                  <span className={`badge ${f.quality_score >= 35 ? 'good' : 'bad'}`} style={{ marginLeft: 4 }}>QA: {f.quality_score}/50</span>
                )}
                {f.job_type !== 'task' && <span className="badge" style={{ marginLeft: 4 }}>{f.job_type}</span>}
              </div>
            </div>
            <div className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {new Date(f.completed_at).toLocaleString()}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
