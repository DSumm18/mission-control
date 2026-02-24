'use client';

import { FormEvent, useEffect, useState } from 'react';

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
  return status === 'paused_proxy' ? 'Paused (proxy)' : status;
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
    <main style={{ padding: 24 }}>
      <h1>Jobs</h1>

      <form onSubmit={onCreate} style={{ display: 'grid', gap: 8, maxWidth: 900, marginBottom: 24 }}>
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
        <button disabled={loading} type="submit">{loading ? 'Creating...' : 'New Job'}</button>
      </form>

      <table cellPadding={8} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Title</th>
            <th align="left">Engine</th>
            <th align="left">Status</th>
            <th align="left">Created</th>
            <th align="left">Run</th>
            <th align="left">Verified</th>
            <th align="left">Evidence Log</th>
            <th align="left">Evidence SHA</th>
            <th align="left">Last Error</th>
            <th align="left">Last Log Path</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderTop: '1px solid #ddd' }}>
              <td>{job.title}</td>
              <td>{job.engine}</td>
              <td>{formatStatus(job.status)}</td>
              <td>{new Date(job.created_at).toLocaleString()}</td>
              <td>
                <button onClick={() => onRun(job.id)} disabled={runningId === job.id || job.status === 'running'}>
                  {runningId === job.id ? 'Running...' : 'Run'}
                </button>
              </td>
              <td>
                {job.verified_at ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ display: 'inline-block', background: '#e7f7ef', color: '#0f5132', borderRadius: 12, padding: '2px 8px', fontSize: 12 }}>Verified</span>
                    <span style={{ fontSize: 12 }}>{new Date(job.verified_at).toLocaleString()}</span>
                  </div>
                ) : ''}
              </td>
              <td style={{ maxWidth: 280, overflowWrap: 'anywhere' }}>
                {job.evidence_log_path ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span title={job.evidence_log_path}>{shortText(job.evidence_log_path, 32)}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(job.evidence_log_path || '')}>Copy</button>
                  </div>
                ) : ''}
              </td>
              <td style={{ maxWidth: 220, overflowWrap: 'anywhere' }}>
                {job.evidence_sha256 ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span title={job.evidence_sha256}>{shortText(job.evidence_sha256, 20)}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(job.evidence_sha256 || '')}>Copy</button>
                  </div>
                ) : ''}
              </td>
              <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{job.last_error || ''}</td>
              <td style={{ maxWidth: 320, overflowWrap: 'anywhere' }}>{job.last_log_path || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
