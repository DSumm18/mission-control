'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Agent = {
  id: string;
  name: string;
  role: string;
  default_engine: string;
  model_id: string | null;
  model_hint: string | null;
  cost_tier: string | null;
  avatar_emoji: string | null;
  active: boolean;
  system_prompt: string | null;
  quality_score_avg: number;
  total_jobs_completed: number;
  consecutive_failures: number;
  notes: string | null;
  reports_to_name: string | null;
  mc_departments: { name: string; slug: string } | null;
};

type PromptVersion = {
  id: string;
  version: number;
  active: boolean;
  performance_delta: number | null;
  created_at: string;
};

type Review = {
  id: string;
  job_id: string;
  total_score: number;
  passed: boolean;
  feedback: string | null;
  created_at: string;
};

type Performance = {
  agent_id: string;
  agent_name: string;
  quality_score_avg: number;
  total_jobs_completed: number;
  consecutive_failures: number;
  cost_tier: string;
  jobs_7d: number;
  jobs_done_7d: number;
  jobs_failed_7d: number;
  avg_quality_7d: number | null;
};

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/agents/${params.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setAgent(d.agent || null);
        setPrompts(d.prompts || []);
        setReviews(d.reviews || []);
        setEditPrompt(d.agent?.system_prompt || '');
      });
    fetch(`/api/agents/${params.id}/performance`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPerformance(d.performance || null));
  }, [params.id]);

  async function savePrompt() {
    if (!agent || !editPrompt.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/agent-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agent.id,
          system_prompt: editPrompt,
          activate: true,
        }),
      });
      // Reload
      const res = await fetch(`/api/agents/${params.id}`, { cache: 'no-store' });
      const d = await res.json();
      setAgent(d.agent || null);
      setPrompts(d.prompts || []);
    } finally {
      setSaving(false);
    }
  }

  if (!agent) {
    return <div><h1 className="page-title">Loading...</h1></div>;
  }

  return (
    <div>
      <Link href="/agents" style={{ fontSize: 13 }}>&larr; Back to Agents</Link>
      <h1 className="page-title" style={{ marginTop: 8 }}>
        {agent.avatar_emoji || '🤖'} {agent.name}
      </h1>
      <p className="page-sub">
        {agent.role} &bull; {agent.mc_departments?.name || 'No department'} &bull; {agent.default_engine}
        {agent.model_id ? ` (${agent.model_id})` : ''}
        {agent.reports_to_name ? ` &bull; reports to ${agent.reports_to_name}` : ''}
      </p>

      {/* KPIs */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Quality Avg</div>
          <div className="kpi">{agent.quality_score_avg || 0}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Jobs Done</div>
          <div className="kpi">{agent.total_jobs_completed}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Failures (streak)</div>
          <div className="kpi">{agent.consecutive_failures}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Cost Tier</div>
          <div className="kpi">{agent.cost_tier || '—'}</div>
        </article>
      </section>

      {/* 7-day performance */}
      {performance && (
        <section className="grid" style={{ marginBottom: 14 }}>
          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="muted">Jobs (7d)</div>
            <div className="kpi">{performance.jobs_7d}</div>
          </article>
          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="muted">Done (7d)</div>
            <div className="kpi">{performance.jobs_done_7d}</div>
          </article>
          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="muted">Failed (7d)</div>
            <div className="kpi">{performance.jobs_failed_7d}</div>
          </article>
          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="muted">Avg Quality (7d)</div>
            <div className="kpi">{performance.avg_quality_7d ? Math.round(performance.avg_quality_7d * 10) / 10 : '—'}</div>
          </article>
        </section>
      )}

      <section className="grid" style={{ marginBottom: 14 }}>
        {/* System Prompt Editor */}
        <article className="card" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0 }}>System Prompt</h3>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={10}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={savePrompt} disabled={saving}>
              {saving ? 'Saving...' : 'Save & Activate New Version'}
            </button>
          </div>
        </article>

        {/* Prompt Version History */}
        <article className="card" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0 }}>Prompt Versions</h3>
          {prompts.length === 0 ? (
            <p className="muted">No versions saved yet</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>V</th><th>Active</th><th>Delta</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {prompts.map((p) => (
                    <tr key={p.id}>
                      <td>v{p.version}</td>
                      <td>
                        <span className={`badge ${p.active ? 'good' : ''}`}>
                          {p.active ? 'active' : '—'}
                        </span>
                      </td>
                      <td>{p.performance_delta !== null ? `${p.performance_delta > 0 ? '+' : ''}${p.performance_delta}` : '—'}</td>
                      <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      {/* Recent Reviews */}
      <section className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Recent Reviews</h3>
        {reviews.length === 0 ? (
          <p className="muted">No reviews yet</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Score</th><th>Passed</th><th>Feedback</th><th>Date</th></tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`badge ${r.total_score >= 35 ? 'good' : 'bad'}`}>
                        {r.total_score}/50
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.passed ? 'good' : 'bad'}`}>
                        {r.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 400, whiteSpace: 'pre-wrap' }}>{r.feedback || '—'}</td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
