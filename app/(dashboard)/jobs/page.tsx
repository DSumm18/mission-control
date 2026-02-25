'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Job = {
  id: string;
  created_at: string;
  title: string;
  engine: 'claude' | 'gemini' | 'openai' | 'shell';
  repo_path: string;
  prompt_text: string;
  output_dir: string;
  status: 'queued' | 'running' | 'paused_human' | 'paused_quota' | 'paused_proxy' | 'done' | 'failed';
  last_log_path?: string | null;
  last_error?: string | null;
  verified_at?: string | null;
  evidence_log_path?: string | null;
  evidence_sha256?: string | null;
};

function formatStatus(status: Job['status']) {
  if (status === 'paused_proxy') return 'Paused (proxy)';
  return status;
}

function badgeClass(status: Job['status']) {
  if (status === 'done') return 'badge good';
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
    return { total, running, done, failed };
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
      <h1 className="page-title">Jobs Runner</h1>
      <p className="page-sub">Create execution jobs, run them through engines, and keep evidence for every outcome.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 3' }}><div className="muted">Total Jobs</div><div className="kpi">{stats.total}</div></article>
        <article className="card" style={{ gridColumn: 'span 3' }}><div className="muted">Running</div><div className="kpi">{stats.running}</div></article>
        <article className="card" style={{ gridColumn: 'span 3' }}><div className="muted">Done</div><div className="kpi">{stats.done}</div></article>
        <article className="card" style={{ gridColumn: 'span 3' }}><div className="muted">Failed</div><div className="kpi">{stats.failed}</div></article>
      </section>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0 }}>New Job</h3>
          <form onSubmit={onCreate} style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            <select value={form.engine} onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value as any }))}>
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
                  <th>Title</th><th>Engine</th><th>Status</th><th>Created</th><th>Run</th><th>Evidence</th><th>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.title}</td>
                    <td>{job.engine}</td>
                    <td><span className={badgeClass(job.status)}>{formatStatus(job.status)}</span></td>
                    <td>{new Date(job.created_at).toLocaleString()}</td>
                    <td>
                      <button onClick={() => onRun(job.id)} disabled={runningId === job.id || job.status === 'running'}>
                        {runningId === job.id ? 'Running…' : 'Run'}
                      </button>
                    </td>
                    <td style={{ maxWidth: 260, overflowWrap: 'anywhere' }}>
                      {job.evidence_log_path ? (
                        <div style={{ display: 'grid', gap: 4 }}>
                          <span title={job.evidence_log_path}>{shortText(job.evidence_log_path, 34)}</span>
                          {job.evidence_sha256 && <span className="muted" title={job.evidence_sha256}>{shortText(job.evidence_sha256, 24)}</span>}
                        </div>
                      ) : '—'}
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
