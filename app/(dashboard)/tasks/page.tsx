'use client';

import { FormEvent, useEffect, useState } from 'react';
import PageInfo from '@/components/ui/PageInfo';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  mc_projects: { id: string; name: string } | null;
};

type Project = {
  id: string;
  name: string;
};

function priorityBadge(p: number) {
  if (p <= 2) return 'bad';
  if (p <= 5) return 'warn';
  return 'good';
}

const STATUS_TABS = ['all', 'todo', 'in_progress', 'done', 'cancelled'] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [projFilter, setProjFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', project_id: '', priority: '5', due_date: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (projFilter) params.set('project_id', projFilter);
    const res = await fetch(`/api/tasks?${params}`, { cache: 'no-store' });
    const d = await res.json();
    setTasks(d.tasks || []);
  }

  useEffect(() => { load(); }, [filter, projFilter]);

  useEffect(() => {
    fetch('/api/projects', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setProjects(d.projects || []));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          project_id: form.project_id || undefined,
          priority: Number(form.priority),
          due_date: form.due_date || undefined,
        }),
      });
      setForm({ title: '', description: '', project_id: '', priority: '5', due_date: '' });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await load();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await load();
  }

  const counts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">My Tasks</h1>
          <PageInfo title="My Tasks" description="Personal task board. Track what needs doing across all projects — assigned to you, agents, or Ed." features={["Create tasks with priority, due dates, and project links", "Filter by status: todo, in progress, done", "Inline status updates — click the badge to cycle", "Tasks feed into agent job creation"]} />
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>
      <p className="page-sub">Personal task list across all projects. {counts.todo} todo, {counts.in_progress} in progress.</p>

      {/* Add Task Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <form onSubmit={onCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="Task title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={{ gridColumn: 'span 2' }} />
            <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ gridColumn: 'span 2' }} />
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Priority {n}{n <= 2 ? ' (urgent)' : n <= 5 ? '' : ' (low)'}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Task'}</button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={filter === s ? 'btn-primary btn-sm' : 'btn-sm'}
            style={{ textTransform: 'capitalize' }}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
        <select value={projFilter} onChange={e => setProjFilter(e.target.value)} style={{ marginLeft: 'auto', fontSize: 13, padding: '5px 10px' }}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Task List */}
      <div style={{ display: 'grid', gap: 8 }}>
        {tasks.map(t => (
          <div key={t.id} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={() => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{
                    fontWeight: 500,
                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    opacity: t.status === 'done' ? 0.6 : 1,
                  }}>{t.title}</span>
                </div>
                {t.description && <div className="muted" style={{ marginTop: 4, marginLeft: 24, fontSize: 12 }}>{t.description}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, marginLeft: 24, flexWrap: 'wrap' }}>
                  <span className={`badge ${priorityBadge(t.priority)}`}>P{t.priority}</span>
                  {t.mc_projects && <span className="badge accent">{t.mc_projects.name}</span>}
                  {t.due_date && <span className="badge">{t.due_date}</span>}
                  <span className={`badge ${t.status === 'done' ? 'good' : t.status === 'in_progress' ? 'warn' : ''}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {t.status === 'todo' && (
                  <button className="btn-sm" onClick={() => updateTask(t.id, { status: 'in_progress' })}>Start</button>
                )}
                {t.status === 'in_progress' && (
                  <button className="btn-sm" onClick={() => updateTask(t.id, { status: 'done' })}>Done</button>
                )}
                <button className="btn-sm" onClick={() => deleteTask(t.id)} style={{ color: 'var(--bad)' }}>x</button>
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
            No tasks matching filter
          </div>
        )}
      </div>
    </div>
  );
}
