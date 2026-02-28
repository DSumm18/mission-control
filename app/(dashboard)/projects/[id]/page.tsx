'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FolderOpen, Target, Briefcase, Activity, Settings as SettingsIcon,
  Play, Terminal, CheckCircle, Clock, Zap,
} from 'lucide-react';
import AnimatedKPI from '@/components/ui/AnimatedKPI';
import { SkeletonKPI } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { FileText } from 'lucide-react';

const SPEC_TEMPLATE = {
  overview: '',
  target_audience: '',
  tech_stack: [],
  revenue_model: '',
  current_status: '',
  key_blockers: [],
  milestones: [
    {
      name: 'Milestone 1',
      target: '',
      status: 'not_started',
      acceptance_criteria: [],
      features: [],
      constraints: {
        musts: [],
        must_nots: [],
        preferences: [],
        escalation: [],
      },
    },
  ],
  decomposition_pattern: '',
  evaluation: {
    build_must_pass: true,
    test_command: '',
    verify_url: '',
  },
};

type Milestone = { name: string; target: string; status: string };

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repo_path: string | null;
  delivery_plan: { milestones?: Milestone[] };
  status: string;
  revenue_target_monthly: number | null;
  mc_agents: { id: string; name: string; avatar_emoji: string | null } | null;
};

type Job = {
  id: string;
  title: string;
  status: string;
  engine: string;
  quality_score: number | null;
  agent_id: string | null;
  created_at: string;
  completed_at: string | null;
  job_type: string;
  cost_usd?: number;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: number;
  task_type: string;
  assigned_to: string;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  statusColor: string;
  timestamp: string;
};

type Tab = 'overview' | 'tasks' | 'jobs' | 'activity' | 'settings';

function statusBadge(status: string) {
  if (['done', 'active', 'completed'].includes(status)) return 'good';
  if (['in_progress', 'paused', 'queued', 'running', 'reviewing', 'todo'].includes(status)) return 'warn';
  return 'bad';
}

export default function ProjectCommandCenter() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [editPlan, setEditPlan] = useState('');
  const [editRepoPath, setEditRepoPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchTask, setLaunchTask] = useState('');

  const fetchProject = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/projects/${params.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setProject(d.project || null);
        setJobs(d.jobs || []);
        if (d.project?.delivery_plan) {
          setEditPlan(JSON.stringify(d.project.delivery_plan, null, 2));
        }
        if (d.project?.repo_path) {
          setEditRepoPath(d.project.repo_path);
        }
      })
      .catch(() => {});
  }, [params.id]);

  const fetchTasks = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/tasks?project_id=${params.id}&limit=50`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
      .catch(() => {});
  }, [params.id]);

  const fetchActivity = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/activity?project_id=${params.id}&limit=20`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setActivity(d.items || []))
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    fetchProject();
    fetchTasks();
    fetchActivity();
  }, [fetchProject, fetchTasks, fetchActivity]);

  if (!project) {
    return (
      <div>
        <h1 className="page-title">Loading...</h1>
        <div className="grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ gridColumn: 'span 3' }}>
              <SkeletonKPI />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const milestones = project.delivery_plan?.milestones || [];
  const doneMilestones = milestones.filter(m => m.status === 'done').length;
  const milestoneProgress = milestones.length > 0 ? Math.round((doneMilestones / milestones.length) * 100) : 0;
  const doneJobs = jobs.filter(j => j.status === 'done').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;
  const totalCost = jobs.reduce((s, j) => s + (j.cost_usd || 0), 0);
  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => ['done', 'completed'].includes(t.status));

  async function savePlan() {
    if (!project) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(editPlan);
      await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_plan: parsed }),
      });
      toast('Project specification saved', 'good');
      fetchProject();
    } catch {
      toast('Invalid JSON', 'bad');
    } finally {
      setSaving(false);
    }
  }

  async function saveRepoPath() {
    setSaving(true);
    try {
      await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: editRepoPath }),
      });
      toast('Repo path saved', 'good');
      fetchProject();
    } catch {
      toast('Failed to save', 'bad');
    } finally {
      setSaving(false);
    }
  }

  async function launchAutonomous() {
    if (!launchTask.trim()) {
      toast('Describe the task first', 'warn');
      return;
    }
    setLaunching(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/launch-claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: launchTask, mode: 'autonomous' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Job created: ${data.job_id || 'queued'}`, 'good');
        setLaunchTask('');
        fetchProject();
      } else {
        toast(data.error || 'Failed to launch', 'bad');
      }
    } catch {
      toast('Network error', 'bad');
    } finally {
      setLaunching(false);
    }
  }

  async function cycleTaskStatus(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'todo' ? 'in_progress' : currentStatus === 'in_progress' ? 'done' : 'todo';
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      toast(`Task moved to ${nextStatus}`, 'good');
      fetchTasks();
    } catch {
      toast('Failed to update task', 'bad');
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof FolderOpen }[] = [
    { key: 'overview', label: 'Overview', icon: FolderOpen },
    { key: 'tasks', label: 'Tasks', icon: CheckCircle },
    { key: 'jobs', label: 'Jobs', icon: Briefcase },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div>
      <Link href="/projects" style={{ fontSize: 13 }}>&larr; Back to Projects</Link>
      <h1 className="page-title" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
        {project.name}
        <span className={`badge ${statusBadge(project.status)}`}>{project.status}</span>
      </h1>
      <p className="page-sub">
        {project.description || 'No description'}
        {project.mc_agents ? ` \u00B7 PM: ${project.mc_agents.avatar_emoji || '\uD83E\uDD16'} ${project.mc_agents.name}` : ''}
        {project.revenue_target_monthly ? ` \u00B7 Target: \u00A3${project.revenue_target_monthly.toLocaleString()}/mo` : ''}
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: '8px 8px 0 0',
                border: 'none', background: tab === t.key ? 'rgba(110,168,254,0.08)' : 'transparent',
                color: tab === t.key ? 'var(--accent)' : 'var(--muted)',
                fontWeight: tab === t.key ? 600 : 400,
                cursor: 'pointer', fontSize: 13,
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <>
          {/* KPIs */}
          <section className="grid" style={{ marginBottom: 14 }}>
            <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
              <div className="muted"><Target size={14} style={{ verticalAlign: 'middle' }} /> Revenue Target</div>
              <div className="kpi">
                {project.revenue_target_monthly ? (
                  <AnimatedKPI value={project.revenue_target_monthly} prefix={'\u00A3'} />
                ) : '\u2014'}
              </div>
              <div className="muted">per month</div>
            </article>
            <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
              <div className="muted">Milestone Progress</div>
              <div className="kpi"><AnimatedKPI value={milestoneProgress} suffix="%" /></div>
              <div className="progress-bar" style={{ marginTop: 4 }}>
                <div className="progress-fill" style={{ width: `${milestoneProgress}%`, background: 'var(--good)' }} />
              </div>
            </article>
            <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
              <div className="muted"><Briefcase size={14} style={{ verticalAlign: 'middle' }} /> Jobs</div>
              <div className="kpi"><AnimatedKPI value={doneJobs} />/{jobs.length}</div>
              <div className="muted">{failedJobs > 0 ? `${failedJobs} failed` : 'completed'}</div>
            </article>
            <article className="card card-glow-active card-animated" style={{ gridColumn: 'span 3' }}>
              <div className="muted">Total Cost</div>
              <div className="kpi"><AnimatedKPI value={totalCost} prefix="$" decimals={4} /></div>
              <div className="muted">all time</div>
            </article>
          </section>

          {/* Milestone Timeline */}
          {milestones.length > 0 && (
            <section className="card card-animated" style={{ marginBottom: 14 }}>
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Milestone Timeline</h3>
              <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
                {milestones.map((m, i) => (
                  <div key={i} style={{ flex: '1 0 0', minWidth: 100, position: 'relative', textAlign: 'center' }}>
                    {/* Connector line */}
                    {i > 0 && (
                      <div style={{
                        position: 'absolute', left: 0, top: 12, width: '50%', height: 2,
                        background: milestones[i - 1].status === 'done' ? 'var(--good)' : 'var(--line)',
                      }} />
                    )}
                    {i < milestones.length - 1 && (
                      <div style={{
                        position: 'absolute', right: 0, top: 12, width: '50%', height: 2,
                        background: m.status === 'done' ? 'var(--good)' : 'var(--line)',
                      }} />
                    )}
                    {/* Node */}
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', margin: '0 auto 6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: m.status === 'done' ? 'var(--good)' : m.status === 'in_progress' ? 'var(--accent)' : 'var(--panel-2)',
                      border: `2px solid ${m.status === 'done' ? 'var(--good)' : m.status === 'in_progress' ? 'var(--accent)' : 'var(--line)'}`,
                      position: 'relative', zIndex: 1,
                      fontSize: 10, color: m.status === 'done' ? '#fff' : 'var(--muted)',
                    }}>
                      {m.status === 'done' ? '\u2713' : i + 1}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.3 }}>{m.name}</div>
                    {m.target && <div className="muted" style={{ fontSize: 10 }}>{m.target}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Launch Claude Code */}
          <section className="card card-animated" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={16} color="var(--accent)" /> Work on this Project
            </h3>
            {project.repo_path ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <textarea
                    value={launchTask}
                    onChange={e => setLaunchTask(e.target.value)}
                    placeholder="Describe the task... e.g. Fix the login flow and add error handling"
                    rows={2}
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={launchAutonomous}
                  disabled={launching || !launchTask.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                >
                  <Play size={14} /> {launching ? 'Launching...' : 'Launch Autonomous'}
                </button>
              </div>
            ) : (
              <div className="muted">
                Set a repo path in Settings to enable Claude Code launch.
              </div>
            )}
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              Claude Code will work autonomously in the project repo. Ed will notify you when done.
            </div>
          </section>
        </>
      )}

      {/* TASKS TAB */}
      {tab === 'tasks' && (
        <div>
          {[
            { label: 'To Do', items: todoTasks, color: 'var(--muted)' },
            { label: 'In Progress', items: inProgressTasks, color: 'var(--accent)' },
            { label: 'Completed', items: completedTasks, color: 'var(--good)' },
          ].map(group => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-dot" style={{ background: group.color }} />
                {group.label} ({group.items.length})
              </h3>
              {group.items.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, paddingLeft: 20 }}>None</div>
              ) : (
                <div className="card" style={{ padding: 0 }}>
                  {group.items.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                      <button
                        className="btn-sm"
                        onClick={() => cycleTaskStatus(t.id, t.status)}
                        title="Cycle status"
                        style={{ padding: '3px 6px', fontSize: 11 }}
                      >
                        <span className={`badge ${statusBadge(t.status)}`}>{t.status}</span>
                      </button>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500 }}>{t.title}</span>
                        <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
                          {t.task_type} \u00B7 {t.assigned_to}
                        </span>
                      </div>
                      <span className={`badge ${t.priority <= 2 ? 'bad' : t.priority <= 5 ? 'warn' : 'good'}`}>
                        P{t.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* JOBS TAB */}
      {tab === 'jobs' && (
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Job History ({jobs.length})</h3>
          {jobs.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No jobs for this project yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Title</th><th>Engine</th><th>Type</th><th>Status</th><th>QA</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id}>
                      <td style={{ fontWeight: 500 }}>{j.title}</td>
                      <td>{j.engine}</td>
                      <td>{j.job_type}</td>
                      <td><span className={`badge ${statusBadge(j.status)}`}>{j.status}</span></td>
                      <td>
                        {j.quality_score !== null ? (
                          <span className={`badge ${j.quality_score >= 35 ? 'good' : 'bad'}`}>
                            {j.quality_score}/50
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className="muted" style={{ fontSize: 11 }}>
                        {new Date(j.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY TAB */}
      {tab === 'activity' && (
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 15 }}>
            <Activity size={14} style={{ verticalAlign: 'middle' }} /> Project Activity
          </h3>
          {activity.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No activity for this project</div>
          ) : activity.map(item => (
            <div key={item.id} className="feed-item" style={{ padding: '8px 0' }}>
              <div className="feed-dot" style={{
                background: `var(--${item.statusColor === 'accent' ? 'accent' : item.statusColor})`,
              }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{item.title}</span>
                <div className="muted" style={{ fontSize: 11 }}>
                  <span className={`badge ${item.statusColor}`}>{item.status}</span>
                  <span style={{ marginLeft: 6 }}>{item.detail}</span>
                </div>
              </div>
              <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {new Date(item.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <div className="grid">
          <article className="card" style={{ gridColumn: 'span 6' }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Repo Path</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={editRepoPath}
                onChange={e => setEditRepoPath(e.target.value)}
                placeholder="/Users/david/..."
                style={{ flex: 1, fontSize: 13 }}
              />
              <button onClick={saveRepoPath} disabled={saving} className="btn-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </article>
          <article className="card" style={{ gridColumn: 'span 6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Project Specification (JSON)</h3>
              <button
                className="btn-sm"
                onClick={() => {
                  setEditPlan(JSON.stringify(SPEC_TEMPLATE, null, 2));
                  toast('Template loaded — fill in the fields', 'good');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
              >
                <FileText size={12} /> Load Template
              </button>
            </div>
            <textarea
              value={editPlan}
              onChange={e => setEditPlan(e.target.value)}
              rows={12}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            />
            <button onClick={savePlan} disabled={saving} style={{ marginTop: 8 }}>
              {saving ? 'Saving...' : 'Save Spec'}
            </button>
          </article>
        </div>
      )}
    </div>
  );
}
