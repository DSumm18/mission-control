'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ── types ───────────────────────────────────────────────── */

type Newsletter = {
  id: string;
  title: string;
  week_no: number | null;
  issue_type: string;
  url: string;
  notes: string | null;
  summary: string | null;
  topic_category: string | null;
  tool_decision: string | null;
  tool_name: string | null;
  pipeline_status: string;
  draft_version: string | null;
  snippet_url: string | null;
  tool_url: string | null;
  publish_date: string | null;
  source_updates_count: number;
  total_score: number | null;
  total_score_v2: number | null;
  ready_to_publish: boolean | null;
  reviewed_at: string | null;
};

type KPIs = {
  total: number;
  published: number;
  inProgress: number;
  avgQa: number | null;
  toolsBuilt: number;
  nextPublish: string | null;
};

/* ── constants ───────────────────────────────────────────── */

const STAGES = ['all', 'research', 'draft', 'app_build', 'qa_review', 'approved', 'published'] as const;

const STAGE_LABELS: Record<string, string> = {
  all: 'All',
  research: 'Research',
  draft: 'Draft',
  app_build: 'App Build',
  qa_review: 'QA Review',
  approved: 'Approved',
  published: 'Published',
};

const STAGE_COLORS: Record<string, string> = {
  research: '#8b5cf6',
  draft: '#f59e0b',
  app_build: '#3b82f6',
  qa_review: '#ec4899',
  approved: '#10b981',
  published: '#22d3ee',
};

const TOPIC_AREAS = ['finance', 'safeguarding', 'ofsted', 'estates', 'attendance', 'send', 'ai-policy', 'governance', 'other'];

/* ── component ───────────────────────────────────────────── */

export default function NewsletterPipelinePage() {
  const [items, setItems] = useState<Newsletter[]>([]);
  const [kpis, setKpis] = useState<KPIs>({ total: 0, published: 0, inProgress: 0, avgQa: null, toolsBuilt: 0, nextPublish: null });
  const [activeStage, setActiveStage] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    title: '', week_no: '', url: '', topic_category: '', pipeline_status: 'research',
    draft_version: '', tool_name: '', tool_decision: '', snippet_url: '', tool_url: '',
    publish_date: '', summary: '',
  });

  async function load() {
    const res = await fetch('/api/newsletters', { cache: 'no-store' });
    const data = await res.json();
    setItems(data.items || []);
    setKpis(data.kpis || kpis);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (activeStage === 'all') return items;
    return items.filter((i) => i.pipeline_status === activeStage);
  }, [items, activeStage]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const s of STAGES) {
      if (s !== 'all') counts[s] = items.filter((i) => i.pipeline_status === s).length;
    }
    return counts;
  }, [items]);

  async function advanceStage(item: Newsletter) {
    const order = ['research', 'draft', 'app_build', 'qa_review', 'approved', 'published'];
    const idx = order.indexOf(item.pipeline_status);
    if (idx < 0 || idx >= order.length - 1) return;
    const next = order[idx + 1];
    const res = await fetch(`/api/newsletters/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_status: next }),
    });
    if (res.ok) await load();
    else alert('Failed to advance stage');
  }

  async function createNewsletter(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { ...newForm };
      if (newForm.week_no) payload.week_no = Number(newForm.week_no);
      else delete payload.week_no;
      // Remove empty strings
      for (const k of Object.keys(payload)) {
        if (payload[k] === '') delete payload[k];
      }
      const res = await fetch('/api/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Create failed'); return; }
      setShowCreate(false);
      setNewForm({ title: '', week_no: '', url: '', topic_category: '', pipeline_status: 'research', draft_version: '', tool_name: '', tool_decision: '', snippet_url: '', tool_url: '', publish_date: '', summary: '' });
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Newsletter Pipeline</h1>
      <p className="page-sub">Manage the Schoolgle Signal production pipeline — research, draft, build, QA, publish.</p>

      {/* ── KPI Cards ─────────────────────────── */}
      <section className="grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard label="Total Issues" value={`${kpis.published} / ${kpis.total}`} sub="published / total" color="#22d3ee" />
        <KpiCard label="Avg QA Score" value={kpis.avgQa != null ? `${kpis.avgQa}/120` : '—'} sub="governance total" color="#f59e0b" />
        <KpiCard label="Tools Built" value={`${kpis.toolsBuilt} / ${kpis.total}`} sub="with tool URL" color="#10b981" />
        <KpiCard label="Next Publish" value={kpis.nextPublish || 'TBD'} sub="upcoming date" color="#8b5cf6" />
      </section>

      {/* ── Stage Filter Tabs ─────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStage(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: activeStage === s ? '2px solid #60a5fa' : '1px solid #2a3559',
              background: activeStage === s ? '#1e293b' : 'transparent',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {STAGE_LABELS[s]} <span style={{ opacity: 0.6, marginLeft: 4 }}>({stageCounts[s] || 0})</span>
          </button>
        ))}
      </div>

      {/* ── Pipeline Table ────────────────────── */}
      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Wk</th>
                <th>Title</th>
                <th>Topic</th>
                <th>Stage</th>
                <th>Sources</th>
                <th>QA Core</th>
                <th>QA Gov</th>
                <th>Tool</th>
                <th>Snippet</th>
                <th>Draft</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.week_no ?? '—'}</td>
                  <td>
                    <Link href={`/newsletters/${item.id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>
                      {item.title}
                    </Link>
                  </td>
                  <td>{item.topic_category || '—'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12,
                      background: STAGE_COLORS[item.pipeline_status] || '#475569',
                      color: '#fff',
                    }}>
                      {STAGE_LABELS[item.pipeline_status] || item.pipeline_status}
                    </span>
                  </td>
                  <td>{item.source_updates_count}</td>
                  <td>
                    <ScoreCell score={item.total_score} max={60} threshold={44} />
                  </td>
                  <td>
                    <ScoreCell score={item.total_score_v2} max={120} threshold={78} />
                  </td>
                  <td>{item.tool_url ? <span style={{ color: '#10b981' }}>&#10003;</span> : '—'}</td>
                  <td>{item.snippet_url ? <span style={{ color: '#10b981' }}>&#10003;</span> : '—'}</td>
                  <td style={{ fontSize: 12, opacity: 0.7 }}>{item.draft_version || '—'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    {item.pipeline_status !== 'published' && (
                      <button onClick={() => advanceStage(item)} style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #2a3559', background: '#1e293b', color: '#e2e8f0' }}>
                        Advance
                      </button>
                    )}
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #2a3559', background: 'transparent', color: '#60a5fa', textDecoration: 'none' }}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>No newsletters in this stage</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* ── Create Newsletter ─────────────────── */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #2a3559', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer' }}
        >
          {showCreate ? '— Close' : '+ New Newsletter'}
        </button>
      </div>

      {showCreate && (
        <article className="card" style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 0 }}>Create Newsletter</h3>
          <form onSubmit={createNewsletter} style={{ display: 'grid', gap: 8, maxWidth: 600 }}>
            <input placeholder="Title *" value={newForm.title} onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))} required />
            <input type="number" placeholder="Week number" value={newForm.week_no} onChange={(e) => setNewForm((f) => ({ ...f, week_no: e.target.value }))} />
            <input placeholder="URL *" type="url" value={newForm.url} onChange={(e) => setNewForm((f) => ({ ...f, url: e.target.value }))} required />
            <select value={newForm.topic_category} onChange={(e) => setNewForm((f) => ({ ...f, topic_category: e.target.value }))}>
              <option value="">Topic category</option>
              {TOPIC_AREAS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={newForm.pipeline_status} onChange={(e) => setNewForm((f) => ({ ...f, pipeline_status: e.target.value }))}>
              {STAGES.filter((s) => s !== 'all').map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <input placeholder="Draft version (e.g. v1-draft)" value={newForm.draft_version} onChange={(e) => setNewForm((f) => ({ ...f, draft_version: e.target.value }))} />
            <input placeholder="Tool name" value={newForm.tool_name} onChange={(e) => setNewForm((f) => ({ ...f, tool_name: e.target.value }))} />
            <select value={newForm.tool_decision} onChange={(e) => setNewForm((f) => ({ ...f, tool_decision: e.target.value }))}>
              <option value="">Tool decision</option>
              <option value="create_new">create_new</option>
              <option value="adapt_existing">adapt_existing</option>
              <option value="reuse_existing">reuse_existing</option>
              <option value="no_tool">no_tool</option>
            </select>
            <input placeholder="Snippet URL" type="url" value={newForm.snippet_url} onChange={(e) => setNewForm((f) => ({ ...f, snippet_url: e.target.value }))} />
            <input placeholder="Tool URL" type="url" value={newForm.tool_url} onChange={(e) => setNewForm((f) => ({ ...f, tool_url: e.target.value }))} />
            <input type="date" placeholder="Publish date" value={newForm.publish_date} onChange={(e) => setNewForm((f) => ({ ...f, publish_date: e.target.value }))} />
            <textarea rows={2} placeholder="Summary" value={newForm.summary} onChange={(e) => setNewForm((f) => ({ ...f, summary: e.target.value }))} />
            <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
          </form>
        </article>
      )}

      {/* ── Pricing Tiers ─────────────────────── */}
      <section style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 10, color: '#94a3b8' }}>Subscription Tiers</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <PricingCard
            tier="Free"
            price="£0"
            features={['Weekly newsletter', 'National headline snippet', '1 LA preview per issue']}
            color="#94a3b8"
          />
          <PricingCard
            tier="Member"
            price="£9.99/mo"
            features={['Full LA drill-down data', 'Multi-LA comparison', 'CSV/PDF export', 'All newsletter archives']}
            color="#60a5fa"
          />
          <PricingCard
            tier="Pro"
            price="£29.99/mo"
            features={['Trust-wide analytics', 'Cross-trust benchmarking', 'Governor report templates', 'Priority support']}
            color="#f59e0b"
          />
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <article className="card" style={{ textAlign: 'center', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.5 }}>{sub}</div>
    </article>
  );
}

function ScoreCell({ score, max, threshold }: { score: number | null; max: number; threshold: number }) {
  if (score == null) return <span style={{ opacity: 0.3 }}>—</span>;
  const pass = score >= threshold;
  return (
    <span style={{ color: pass ? '#10b981' : '#ef4444', fontWeight: 600 }}>
      {score}/{max}
    </span>
  );
}

function PricingCard({ tier, price, features, color }: { tier: string; price: string; features: string[]; color: string }) {
  return (
    <article className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{tier}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{price}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, opacity: 0.8, lineHeight: 1.8 }}>
        {features.map((f) => <li key={f}>{f}</li>)}
      </ul>
    </article>
  );
}
