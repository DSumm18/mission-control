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

type PromptVersion = { id: string; version: number; active: boolean; performance_delta: number | null; created_at: string };
type Review = { id: string; job_id: string; total_score: number; passed: boolean; feedback: string | null; created_at: string };
type Performance = { jobs_7d: number; jobs_done_7d: number; jobs_failed_7d: number; avg_quality_7d: number | null };
type SkillAssignment = { id: string; key: string; category: string | null; mcp_server_name: string | null; assigned: boolean };

const MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929', 'claude-opus-4-6'];
const ENGINES = ['claude', 'shell', 'gemini', 'openai'];
const ROLES = ['orchestrator', 'researcher', 'coder', 'qa', 'publisher', 'ops', 'analyst'];
const COST_TIERS = ['free', 'low', 'medium', 'high'];

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [skills, setSkills] = useState<SkillAssignment[]>([]);
  const [editPrompt, setEditPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Editable settings
  const [editModel, setEditModel] = useState('');
  const [editEngine, setEditEngine] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editEmoji, setEditEmoji] = useState('');
  const [editNotes, setEditNotes] = useState('');

  function loadAgent() {
    if (!params.id) return;
    fetch(`/api/agents/${params.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const a = d.agent;
        setAgent(a || null);
        setPrompts(d.prompts || []);
        setReviews(d.reviews || []);
        setEditPrompt(a?.system_prompt || '');
        setEditModel(a?.model_id || '');
        setEditEngine(a?.default_engine || 'claude');
        setEditRole(a?.role || '');
        setEditCost(a?.cost_tier || '');
        setEditActive(a?.active ?? true);
        setEditEmoji(a?.avatar_emoji || '');
        setEditNotes(a?.notes || '');
      });
    fetch(`/api/agents/${params.id}/performance`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setPerformance(d.performance || null));
    fetch(`/api/agents/${params.id}/skills`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setSkills(d.skills || []))
      .catch(() => {});
  }

  useEffect(() => { loadAgent(); }, [params.id]);

  async function savePrompt() {
    if (!agent || !editPrompt.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/agent-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.id, system_prompt: editPrompt, activate: true }),
      });
      loadAgent();
    } finally { setSaving(false); }
  }

  async function saveSettings() {
    if (!agent) return;
    setSettingsSaving(true);
    try {
      await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: editModel || null,
          default_engine: editEngine,
          role: editRole,
          cost_tier: editCost || null,
          active: editActive,
          avatar_emoji: editEmoji || null,
          notes: editNotes || null,
        }),
      });
      loadAgent();
    } finally { setSettingsSaving(false); }
  }

  async function toggleSkill(skillId: string, assigned: boolean) {
    await fetch(`/api/agents/${params.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_id: skillId, assigned }),
    });
    const res = await fetch(`/api/agents/${params.id}/skills`, { cache: 'no-store' });
    const d = await res.json();
    setSkills(d.skills || []);
  }

  if (!agent) return <div><h1 className="page-title">Loading...</h1></div>;

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
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Quality Avg</div>
          <div className="kpi">{agent.quality_score_avg || 0}</div>
        </article>
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Jobs Done</div>
          <div className="kpi">{agent.total_jobs_completed}</div>
        </article>
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Failures</div>
          <div className="kpi" style={{ color: agent.consecutive_failures > 0 ? 'var(--bad)' : undefined }}>
            {agent.consecutive_failures}
          </div>
        </article>
        <article className="card card-glow" style={{ gridColumn: 'span 3' }}>
          <div className="muted">7d Jobs</div>
          <div className="kpi">{performance?.jobs_7d ?? '—'}</div>
        </article>
      </section>

      {/* Settings + Skills */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Agent Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Model</label>
              <select value={editModel} onChange={e => setEditModel(e.target.value)} style={{ width: '100%' }}>
                <option value="">Default</option>
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Engine</label>
              <select value={editEngine} onChange={e => setEditEngine(e.target.value)} style={{ width: '100%' }}>
                {ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Role</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width: '100%' }}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Cost Tier</label>
              <select value={editCost} onChange={e => setEditCost(e.target.value)} style={{ width: '100%' }}>
                <option value="">None</option>
                {COST_TIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Avatar Emoji</label>
              <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} placeholder="🤖" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Active</label>
              <label className="toggle">
                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
              <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Agent notes" style={{ width: '100%' }} />
            </div>
          </div>
          <button onClick={saveSettings} disabled={settingsSaving} className="btn-primary" style={{ marginTop: 10 }}>
            {settingsSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </article>

        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Skills Assignment</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {skills.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{s.key}</span>
                  {s.mcp_server_name && <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>({s.mcp_server_name})</span>}
                  {s.category && <span className="badge" style={{ marginLeft: 6 }}>{s.category}</span>}
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={s.assigned} onChange={e => toggleSkill(s.id, e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            ))}
            {skills.length === 0 && <div className="muted">No skills available</div>}
          </div>
        </article>
      </section>

      {/* System Prompt + Versions */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0 }}>System Prompt</h3>
          <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={14} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
          <button onClick={savePrompt} disabled={saving} className="btn-primary" style={{ marginTop: 8 }}>
            {saving ? 'Saving...' : 'Save & Activate New Version'}
          </button>
        </article>
        <article className="card" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0 }}>Prompt Versions</h3>
          {prompts.length === 0 ? (
            <p className="muted">No versions saved yet</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>V</th><th>Active</th><th>Delta</th><th>Created</th></tr></thead>
                <tbody>
                  {prompts.map(p => (
                    <tr key={p.id}>
                      <td>v{p.version}</td>
                      <td><span className={`badge ${p.active ? 'good' : ''}`}>{p.active ? 'active' : '—'}</span></td>
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

      {/* Reviews */}
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Recent Reviews</h3>
        {reviews.length === 0 ? (
          <p className="muted">No reviews yet</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Score</th><th>Passed</th><th>Feedback</th><th>Date</th></tr></thead>
              <tbody>
                {reviews.map(r => (
                  <tr key={r.id}>
                    <td><span className={`badge ${r.total_score >= 35 ? 'good' : 'bad'}`}>{r.total_score}/50</span></td>
                    <td><span className={`badge ${r.passed ? 'good' : 'bad'}`}>{r.passed ? 'PASS' : 'FAIL'}</span></td>
                    <td style={{ maxWidth: 400, whiteSpace: 'pre-wrap', fontSize: 12 }}>{r.feedback || '—'}</td>
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
