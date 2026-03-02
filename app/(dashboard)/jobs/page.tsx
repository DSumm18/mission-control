'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageInfo from '@/components/ui/PageInfo';

type Job = {
  id: string;
  created_at: string;
  title: string;
  engine: 'claude' | 'gemini' | 'openai' | 'shell';
  repo_path: string;
  prompt_text: string;
  output_dir: string;
  status: string;
  last_log_path?: string | null;
  last_error?: string | null;
  verified_at?: string | null;
  evidence_log_path?: string | null;
  evidence_sha256?: string | null;
  agent_id?: string | null;
  priority?: number;
  job_type?: string;
  quality_score?: number | null;
  project_id?: string | null;
  source?: string;
};

function formatStatus(status: string) {
  if (status === 'paused_proxy') return 'Paused (proxy)';
  return status;
}

function badgeClass(status: string) {
  if (status === 'done') return 'badge good';
  if (status === 'reviewing' || status === 'assigned') return 'badge warn';
  if (status.includes('paused') || status === 'queued' || status === 'running') return 'badge warn';
  return 'badge bad';
}

function shortText(v?: string | null, n = 18) {
  if (!v) return '';
  return v.length > n ? `${v.slice(0, n)}…` : v;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    engine: 'shell',
    repo_path: '/Users/david/.openclaw/workspace',
    prompt_text: '',
    output_dir: '/Users/david/.openclaw/workspace',
  });

  async function loadJobs() {
    const res = await fetch('/api/jobs', { cache: 'no-store' });
    const data = await res.json();
    setJobs(data.jobs || []);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const stats = useMemo(() => {
    const total = jobs.length;
    const running = jobs.filter((j) => j.status === 'running').length;
    const done = jobs.filter((j) => j.status === 'done').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const reviewing = jobs.filter((j) => j.status === 'reviewing').length;
    return { total, running, done, failed, reviewing };
  }, [jobs]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm((f) => ({ ...f, title: '', prompt_text: '' }));
      await loadJobs();
    } finally {
      setLoading(false);
    }
  }

  async function onRun(id: string) {
    setRunningId(id);
    try {
      await fetch(`/api/jobs/${id}/run`, { method: 'POST' });
      await loadJobs();
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Jobs Runner</h1>
        <PageInfo title="Jobs Runner" description="Full job execution log. See every job that has run, is running, or is queued — with status, timing, cost, and quality scores." features={["Filter by status, agent, or job type", "See execution duration and cost per job", "Quality scores from automated QA review", "Click any job to see its full output"]} />
      </div>
      <p className="page-sub">Create execution jobs, run them through engines, and keep evidence for every outcome.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 2' }}><div className="muted">Total</div><div className="kpi">{stats.total}</div></article>
        <article className="card" style={{ gridColumn: 'span 2' }}><div className="muted">Running</div><div className="kpi">{stats.running}</div></article>
        <article className="card" style={{ gridColumn: 'span 2' }}><div className="muted">Reviewing</div><div className="kpi">{stats.reviewing}</div></article>
        <article className="card" style={{ gridColumn: 'span 3' }}><div className="muted">Done</div><div className="kpi">{stats.done}</div></article>
        <article className="card" style={{ gridColumn: 'span 3' }}><div className="muted">Failed</div><div className="kpi">{stats.failed}</div></article>
      </section>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0 }}>New Job</h3>
          <form onSubmit={onCreate} style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            <select value={form.engine} onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value as Job['engine'] }))}>
              <option value="shell">shell</option>
              <option value="claude">claude</option>
              <option value="gemini">gemini</option>
              <option value="openai">openai</option>
            </select>
            <input placeholder="Repo Path" value={form.repo_path} onChange={(e) => setForm((f) => ({ ...f, repo_path: e.target.value }))} required />
            <input placeholder="Output Dir" value={form.output_dir} onChange={(e) => setForm((f) => ({ ...f, output_dir: e.target.value }))} required />
            <textarea placeholder="Prompt text" value={form.prompt_text} onChange={(e) => setForm((f) => ({ ...f, prompt_text: e.target.value }))} rows={6} required />
            <button disabled={loading} type="submit">{loading ? 'Creating…' : 'Create Job'}</button>
          </form>
        </article>

        <article className="card" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0 }}>Execution Queue</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Engine</th><th>Type</th><th>P</th><th>Status</th><th>QA</th><th>Source</th><th>Created</th><th>Run</th><th>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td><Link href={`/jobs/${job.id}`} style={{ color: 'var(--accent)' }}>{job.title}</Link></td>
                    <td>{job.engine}</td>
                    <td>{job.job_type || 'task'}</td>
                    <td>{job.priority || 5}</td>
                    <td><span className={badgeClass(job.status)}>{formatStatus(job.status)}</span></td>
                    <td>
                      {job.quality_score != null ? (
                        <span className={`badge ${job.quality_score >= 35 ? 'good' : 'bad'}`}>
                          {job.quality_score}/50
                        </span>
                      ) : '—'}
                    </td>
                    <td>{job.source || 'dashboard'}</td>
                    <td>{new Date(job.created_at).toLocaleString()}</td>
                    <td>
                      <button onClick={() => onRun(job.id)} disabled={runningId === job.id || job.status === 'running'}>
                        {runningId === job.id ? 'Running…' : 'Run'}
                      </button>
                    </td>
                    <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{job.last_error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
