'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastContext';

type Job = {
  id: string;
  created_at: string;
  title: string;
  engine: string;
  repo_path: string | null;
  prompt_text: string | null;
  status: string;
  result: string | null;
  last_error: string | null;
  last_run_json: Record<string, unknown> | null;
  quality_score: number | null;
  review_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  priority: number | null;
  job_type: string | null;
  source: string | null;
  retry_count: number | null;
  parent_job_id: string | null;
  agent_id: string | null;
  project_id: string | null;
  mc_agents: { name: string; avatar_emoji: string | null } | null;
  mc_projects: { name: string } | null;
};

type Review = {
  id: string;
  completeness: number;
  accuracy: number;
  actionability: number;
  revenue_relevance: number;
  evidence: number;
  passed: boolean;
  feedback: string | null;
  created_at: string;
  mc_agents: { name: string; avatar_emoji: string | null } | null;
};

function statusBadge(s: string) {
  if (s === 'done') return 'good';
  if (s === 'failed' || s === 'rejected') return 'bad';
  return 'warn';
}

function qaColor(score: number) {
  if (score >= 35) return 'var(--good)';
  if (score >= 25) return 'var(--warn)';
  return 'var(--bad)';
}

function dimColor(val: number) {
  if (val >= 8) return 'var(--good)';
  if (val >= 5) return 'var(--warn)';
  return 'var(--bad)';
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '--';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.round((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function ts(v: string | null) {
  if (!v) return '--';
  return new Date(v).toLocaleString();
}

function tryPrettyJson(text: string): string {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      return text.replace(match[0], '```json\n' + JSON.stringify(parsed, null, 2) + '\n```');
    }
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      const parsed = JSON.parse(text.trim());
      return JSON.stringify(parsed, null, 2);
    }
  } catch { /* not JSON */ }
  return text;
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [acting, setActing] = useState(false);

  function loadJob() {
    if (!params.id) return;
    fetch(`/api/jobs/${params.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setJob(d.job || null));
  }

  function loadReviews() {
    if (!params.id) return;
    fetch(`/api/jobs/${params.id}/reviews`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setReviews(d.reviews || []));
  }

  useEffect(() => {
    loadJob();
    loadReviews();
  }, [params.id]);

  async function requeue() {
    setActing(true);
    try {
      const res = await fetch(`/api/jobs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'queued' }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast(d.error || 'Failed to requeue', 'bad');
        return;
      }
      toast('Requeued', 'good');
      loadJob();
    } finally {
      setActing(false);
    }
  }

  async function forceApprove() {
    setActing(true);
    try {
      const res = await fetch(`/api/jobs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast(d.error || 'Failed', 'bad');
        return;
      }
      toast('Force approved', 'good');
      loadJob();
    } finally {
      setActing(false);
    }
  }

  if (!job) {
    return (
      <div>
        <Link href="/jobs" style={{ color: 'var(--accent)', fontSize: 13 }}>&larr; Back to Jobs</Link>
        <h1 className="page-title" style={{ marginTop: 8 }}>Loading...</h1>
      </div>
    );
  }

  const review = reviews[0] || null;

  return (
    <div>
      <Link href="/jobs" style={{ color: 'var(--accent)', fontSize: 13 }}>&larr; Back to Jobs</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{job.title}</h1>
        <span className={`badge ${statusBadge(job.status)}`}>{job.status}</span>
        <span className="badge">{job.engine}</span>
      </div>

      {/* KPI row */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Status</div>
          <div className="kpi"><span className={`badge ${statusBadge(job.status)}`} style={{ fontSize: 16 }}>{job.status}</span></div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">QA Score</div>
          <div className="kpi" style={{ color: job.quality_score != null ? qaColor(job.quality_score) : 'var(--muted)' }}>
            {job.quality_score != null ? `${job.quality_score}/50` : '--'}
          </div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Engine</div>
          <div className="kpi" style={{ fontSize: 22 }}>{job.engine}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Duration</div>
          <div className="kpi" style={{ fontSize: 22 }}>{duration(job.started_at, job.completed_at)}</div>
        </article>
      </section>

      {/* Main content */}
      <section className="grid" style={{ marginBottom: 14 }}>
        {/* Left: output */}
        <article className="card" style={{ gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Output</h3>
            {(job.status === 'failed' || job.status === 'rejected') && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-sm btn-primary" onClick={requeue} disabled={acting}>Re-run</button>
                {job.status === 'rejected' && (
                  <button className="btn-sm" onClick={forceApprove} disabled={acting}>Force Approve</button>
                )}
              </div>
            )}
          </div>
          {job.result ? (
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: 600,
              overflow: 'auto',
              background: 'var(--panel-2)',
              padding: 14,
              borderRadius: 6,
              margin: 0,
            }}>
              {tryPrettyJson(job.result)}
            </pre>
          ) : (
            <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No output recorded</div>
          )}
        </article>

        {/* Right: details */}
        <article className="card" style={{ gridColumn: 'span 4' }}>
          <h3 style={{ margin: '0 0 12px' }}>Details</h3>
          <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
            <div>
              <div className="muted">Agent</div>
              <div>{job.mc_agents ? `${job.mc_agents.avatar_emoji || ''} ${job.mc_agents.name}` : '--'}</div>
            </div>
            <div>
              <div className="muted">Project</div>
              <div>{job.mc_projects?.name || '--'}</div>
            </div>
            <div>
              <div className="muted">Job Type</div>
              <div>{job.job_type || 'task'}</div>
            </div>
            <div>
              <div className="muted">Priority</div>
              <div>{job.priority || 5}</div>
            </div>
            <div>
              <div className="muted">Source</div>
              <div>{job.source || 'dashboard'}</div>
            </div>
            <div>
              <div className="muted">Retry Count</div>
              <div>{job.retry_count || 0}</div>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div className="muted">Created</div>
              <div>{ts(job.created_at)}</div>
            </div>
            <div>
              <div className="muted">Started</div>
              <div>{ts(job.started_at)}</div>
            </div>
            <div>
              <div className="muted">Completed</div>
              <div>{ts(job.completed_at)}</div>
            </div>
            {job.parent_job_id && (
              <div>
                <div className="muted">Parent Job</div>
                <Link href={`/jobs/${job.parent_job_id}`} style={{ color: 'var(--accent)' }}>
                  View parent &rarr;
                </Link>
              </div>
            )}
            {job.repo_path && (
              <div>
                <div className="muted">Repo</div>
                <div style={{ wordBreak: 'break-all' }}>{job.repo_path}</div>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* QA Review breakdown */}
      {review && (
        <section className="grid" style={{ marginBottom: 14 }}>
          <article className="card" style={{ gridColumn: 'span 12' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>QA Review</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  {review.mc_agents ? `${review.mc_agents.avatar_emoji || ''} ${review.mc_agents.name}` : 'Inspector'}
                </span>
                <span className={`badge ${review.passed ? 'good' : 'bad'}`}>
                  {review.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              {([
                ['Completeness', review.completeness],
                ['Accuracy', review.accuracy],
                ['Actionability', review.actionability],
                ['Revenue Relevance', review.revenue_relevance],
                ['Evidence', review.evidence],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
                  <div style={{
                    height: 8, borderRadius: 4,
                    background: 'var(--panel-2)',
                    marginBottom: 4,
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${val * 10}%`,
                      background: dimColor(val),
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: dimColor(val) }}>{val}/10</div>
                </div>
              ))}
            </div>

            {review.feedback && (
              <div style={{
                fontSize: 13, lineHeight: 1.6,
                background: 'var(--panel-2)', padding: 12, borderRadius: 6,
              }}>
                {review.feedback}
              </div>
            )}
          </article>
        </section>
      )}

      {/* Error section */}
      {job.last_error && (job.status === 'failed' || job.status === 'rejected') && (
        <section className="grid" style={{ marginBottom: 14 }}>
          <article className="card" style={{ gridColumn: 'span 12', borderLeft: '3px solid var(--bad)' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--bad)' }}>Error</h3>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: 13, margin: 0, color: 'var(--bad)',
            }}>
              {job.last_error}
            </pre>
          </article>
        </section>
      )}

      {/* Prompt section */}
      {job.prompt_text && (
        <section className="grid">
          <article className="card" style={{ gridColumn: 'span 12' }}>
            <h3 style={{ margin: '0 0 8px' }}>Prompt</h3>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: 12, lineHeight: 1.5,
              maxHeight: 300, overflow: 'auto',
              background: 'var(--panel-2)', padding: 12, borderRadius: 6,
              margin: 0, color: 'var(--muted)',
            }}>
              {job.prompt_text}
            </pre>
          </article>
        </section>
      )}
    </div>
  );
}
