'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';

/* ── types ───────────────────────────────────────────────── */

type Newsletter = {
  id: string;
  title: string;
  week_no: number | null;
  url: string;
  summary: string | null;
  notes: string | null;
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
  // individual scores from latest review
  value_for_money_score: number | null;
  school_relevance_score: number | null;
  actionability_score: number | null;
  clarity_score: number | null;
  differentiation_score: number | null;
  anti_ai_voice_score: number | null;
  source_specificity_score: number | null;
  source_transparency_score: number | null;
  evidence_linking_score: number | null;
  tool_viability_score: number | null;
  tool_qa_score: number | null;
  compliance_confidence_score: number | null;
};

type Review = {
  id: string;
  created_at: string;
  reviewer: string;
  total_score: number;
  total_score_v2: number | null;
  ready_to_publish: boolean;
  value_for_money_score: number;
  school_relevance_score: number;
  actionability_score: number;
  clarity_score: number;
  differentiation_score: number;
  anti_ai_voice_score: number;
  source_specificity_score: number | null;
  source_transparency_score: number | null;
  evidence_linking_score: number | null;
  tool_viability_score: number | null;
  tool_qa_score: number | null;
  compliance_confidence_score: number | null;
  tool_decision: string | null;
  tool_notes: string | null;
  strengths: string | null;
  gaps: string | null;
  recommendations: string | null;
};

type LinkedSource = {
  id: string;
  source_role: string;
  mc_source_updates: {
    id: string;
    headline: string;
    topic_area: string;
    url: string;
    mc_signal_sources: { name: string } | null;
  } | null;
};

type SourceUpdate = { id: string; headline: string; topic_area: string };

/* ── constants ───────────────────────────────────────────── */

const PIPELINE_ORDER = ['research', 'draft', 'app_build', 'qa_review', 'approved', 'published'];

const STAGE_LABELS: Record<string, string> = {
  research: 'Research', draft: 'Draft', app_build: 'App Build',
  qa_review: 'QA Review', approved: 'Approved', published: 'Published',
};

const STAGE_COLORS: Record<string, string> = {
  research: '#8b5cf6', draft: '#f59e0b', app_build: '#3b82f6',
  qa_review: '#ec4899', approved: '#10b981', published: '#22d3ee',
};

const rubricCore = [
  ['Value for money', 'Can a head/SLT justify this spend to governors?', 'value_for_money_score'],
  ['School relevance', 'Directly solves current school/trust priorities', 'school_relevance_score'],
  ['Actionability', 'Clear actions schools can do this week', 'actionability_score'],
  ['Clarity', 'Simple, non-jargon, no ambiguity', 'clarity_score'],
  ['Differentiation', 'Clearly better than generic updates', 'differentiation_score'],
  ['Human voice quality', 'Does not read as AI-written', 'anti_ai_voice_score'],
] as const;

const rubricGovernance = [
  ['Source specificity', 'Specific update/topic identified', 'source_specificity_score'],
  ['Source transparency', 'Sources are visible and attributable', 'source_transparency_score'],
  ['Evidence linkage', 'Data point links to source/dataset trail', 'evidence_linking_score'],
  ['Tool viability', 'Tool choice is realistic for this issue', 'tool_viability_score'],
  ['Tool QA confidence', 'Linked tool has been validated', 'tool_qa_score'],
  ['Compliance confidence', 'Regulatory defensibility is clear', 'compliance_confidence_score'],
] as const;

const PASS_CORE = 44;
const PASS_GOV = 78;

/* ── component ───────────────────────────────────────────── */

export default function NewsletterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sources, setSources] = useState<LinkedSource[]>([]);
  const [sourceUpdates, setSourceUpdates] = useState<SourceUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  // QA form state
  const [form, setForm] = useState<Record<string, unknown>>({
    newsletter_id: id,
    reviewer: 'Ed',
    value_for_money_score: 7, school_relevance_score: 7, actionability_score: 7,
    clarity_score: 7, differentiation_score: 7, anti_ai_voice_score: 7,
    source_specificity_score: 7, source_transparency_score: 7, evidence_linking_score: 7,
    tool_viability_score: 7, tool_qa_score: 7, compliance_confidence_score: 7,
    tool_decision: 'reuse_existing', tool_notes: '', strengths: '', gaps: '', recommendations: '',
  });

  // Source link state
  const [sourceLink, setSourceLink] = useState({ newsletter_id: id, source_update_id: '', source_role: 'supporting' });

  async function load() {
    setLoading(true);
    const [detail, su] = await Promise.all([
      fetch(`/api/newsletters/${id}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/sources/updates', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ updates: [] })),
    ]);
    if (detail.error) { setLoading(false); return; }
    setNewsletter(detail.newsletter);
    setReviews(detail.reviews || []);
    setSources(detail.sources || []);
    setSourceUpdates(su.updates || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // Radar chart data from latest review on the newsletter
  const radarData = useMemo(() => {
    if (!newsletter) return [];
    return [
      { dim: 'Value', score: newsletter.value_for_money_score ?? 0 },
      { dim: 'Relevance', score: newsletter.school_relevance_score ?? 0 },
      { dim: 'Actionable', score: newsletter.actionability_score ?? 0 },
      { dim: 'Clarity', score: newsletter.clarity_score ?? 0 },
      { dim: 'Differentiation', score: newsletter.differentiation_score ?? 0 },
      { dim: 'Human Voice', score: newsletter.anti_ai_voice_score ?? 0 },
      { dim: 'Src Specificity', score: newsletter.source_specificity_score ?? 0 },
      { dim: 'Src Transparency', score: newsletter.source_transparency_score ?? 0 },
      { dim: 'Evidence', score: newsletter.evidence_linking_score ?? 0 },
      { dim: 'Tool Viable', score: newsletter.tool_viability_score ?? 0 },
      { dim: 'Tool QA', score: newsletter.tool_qa_score ?? 0 },
      { dim: 'Compliance', score: newsletter.compliance_confidence_score ?? 0 },
    ];
  }, [newsletter]);

  const totalCore = useMemo(
    () => rubricCore.reduce((a, [, , k]) => a + Number(form[k] || 0), 0), [form]
  );
  const totalV2 = useMemo(
    () => totalCore + rubricGovernance.reduce((a, [, , k]) => a + Number(form[k] || 0), 0), [form, totalCore]
  );

  async function advanceStage() {
    if (!newsletter) return;
    const idx = PIPELINE_ORDER.indexOf(newsletter.pipeline_status);
    if (idx < 0 || idx >= PIPELINE_ORDER.length - 1) return;
    const next = PIPELINE_ORDER[idx + 1];
    const res = await fetch(`/api/newsletters/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_status: next }),
    });
    if (res.ok) await load();
  }

  async function revertStage() {
    if (!newsletter) return;
    const idx = PIPELINE_ORDER.indexOf(newsletter.pipeline_status);
    if (idx <= 0) return;
    const prev = PIPELINE_ORDER[idx - 1];
    const res = await fetch(`/api/newsletters/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_status: prev }),
    });
    if (res.ok) await load();
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/newsletters/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, newsletter_id: id }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Review failed'); return; }
    await load();
    alert(`Saved. Core ${data.review.total_score}/60, Gov ${data.review.total_score_v2}/120 (${data.review.ready_to_publish ? 'READY' : 'NOT READY'})`);
  }

  async function linkSource(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/newsletters/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sourceLink, newsletter_id: id }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Link failed'); return; }
    setSourceLink((s) => ({ ...s, source_update_id: '' }));
    await load();
  }

  if (loading) return <div style={{ padding: 40, opacity: 0.5 }}>Loading...</div>;
  if (!newsletter) return <div style={{ padding: 40 }}>Newsletter not found. <Link href="/newsletters">Back</Link></div>;

  const stageIdx = PIPELINE_ORDER.indexOf(newsletter.pipeline_status);

  return (
    <div>
      {/* ── Header ──────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/newsletters" style={{ color: '#60a5fa', fontSize: 13 }}>&larr; Back to Pipeline</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{newsletter.title}</h1>
        {newsletter.week_no && <span style={{ opacity: 0.5, fontSize: 14 }}>Week {newsletter.week_no}</span>}
        <span style={{
          padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
          background: STAGE_COLORS[newsletter.pipeline_status] || '#475569', color: '#fff',
        }}>
          {STAGE_LABELS[newsletter.pipeline_status] || newsletter.pipeline_status}
        </span>
        {newsletter.topic_category && (
          <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, border: '1px solid #2a3559', color: '#94a3b8' }}>
            {newsletter.topic_category}
          </span>
        )}
      </div>
      {newsletter.summary && <p style={{ opacity: 0.7, marginTop: 0, fontSize: 14 }}>{newsletter.summary}</p>}

      {/* ── Section 1: Status + Metadata ─────── */}
      <section className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Pipeline Status</h3>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {PIPELINE_ORDER.map((s, i) => (
              <div key={s} style={{
                flex: 1, padding: '4px 0', textAlign: 'center', fontSize: 11, borderRadius: 4,
                background: i <= stageIdx ? (STAGE_COLORS[s] || '#475569') : '#1e293b',
                color: i <= stageIdx ? '#fff' : '#475569',
                border: s === newsletter.pipeline_status ? '2px solid #fff' : '1px solid transparent',
              }}>
                {STAGE_LABELS[s]}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={revertStage} disabled={stageIdx <= 0} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #2a3559', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }}>
              &larr; Revert
            </button>
            <button onClick={advanceStage} disabled={stageIdx >= PIPELINE_ORDER.length - 1} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #2a3559', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }}>
              Advance &rarr;
            </button>
          </div>
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Metadata</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
            <span style={{ opacity: 0.5 }}>Draft version</span><span>{newsletter.draft_version || '—'}</span>
            <span style={{ opacity: 0.5 }}>Publish date</span><span>{newsletter.publish_date || '—'}</span>
            <span style={{ opacity: 0.5 }}>Tool</span><span>{newsletter.tool_name || '—'}</span>
            <span style={{ opacity: 0.5 }}>Live URL</span>
            <a href={newsletter.url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12, wordBreak: 'break-all' }}>Open</a>
            <span style={{ opacity: 0.5 }}>Tool URL</span>
            {newsletter.tool_url
              ? <a href={newsletter.tool_url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12 }}>Open tool</a>
              : <span>—</span>}
            <span style={{ opacity: 0.5 }}>Snippet URL</span>
            {newsletter.snippet_url
              ? <a href={newsletter.snippet_url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12 }}>Open snippet</a>
              : <span>—</span>}
          </div>
        </article>
      </section>

      {/* ── Section 2: QA Radar Chart ────────── */}
      <section className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>QA Radar</h3>
          {newsletter.total_score_v2 != null ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="#2a3559" />
                <PolarAngleAxis dataKey="dim" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fill: '#475569', fontSize: 10 }} />
                <Radar dataKey="score" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ opacity: 0.4, padding: 40, textAlign: 'center' }}>No QA scores yet</div>
          )}
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Score Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 13 }}>
            {[...rubricCore, ...rubricGovernance].map(([label, , key]) => {
              const val = newsletter[key as keyof Newsletter] as number | null;
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.6 }}>{label}</span>
                  <span style={{ fontWeight: 600, color: val != null ? (val >= 7 ? '#10b981' : val >= 5 ? '#f59e0b' : '#ef4444') : '#475569' }}>
                    {val ?? '—'}/10
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 14, fontWeight: 700 }}>
            <span>
              Core: <span style={{ color: (newsletter.total_score ?? 0) >= PASS_CORE ? '#10b981' : '#ef4444' }}>
                {newsletter.total_score ?? '—'}/60
              </span>
              {' '}
              <span className={`badge ${(newsletter.total_score ?? 0) >= PASS_CORE ? 'good' : 'bad'}`} style={{ fontSize: 10 }}>
                {(newsletter.total_score ?? 0) >= PASS_CORE ? 'PASS' : 'FAIL'}
              </span>
            </span>
            <span>
              Gov: <span style={{ color: (newsletter.total_score_v2 ?? 0) >= PASS_GOV ? '#10b981' : '#ef4444' }}>
                {newsletter.total_score_v2 ?? '—'}/120
              </span>
              {' '}
              <span className={`badge ${(newsletter.total_score_v2 ?? 0) >= PASS_GOV ? 'good' : 'bad'}`} style={{ fontSize: 10 }}>
                {(newsletter.total_score_v2 ?? 0) >= PASS_GOV ? 'PASS' : 'FAIL'}
              </span>
            </span>
          </div>
        </article>
      </section>

      {/* ── Section 3: QA Scoring Form ───────── */}
      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Score This Newsletter</h3>
        <form onSubmit={submitReview} style={{ display: 'grid', gap: 8, maxWidth: 600 }}>
          <input value={form.reviewer as string} onChange={(e) => setForm((f) => ({ ...f, reviewer: e.target.value }))} placeholder="Reviewer" />

          <h4 style={{ margin: '6px 0 0' }}>Core quality (60)</h4>
          {rubricCore.map(([label, hint, key]) => (
            <label key={key} style={{ display: 'grid', gap: 4 }}>
              <span>{label} <span className="muted">({hint})</span></span>
              <input type="number" min={1} max={10} value={form[key] as number} onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))} />
            </label>
          ))}

          <h4 style={{ margin: '6px 0 0' }}>Source/tool governance (+60)</h4>
          {rubricGovernance.map(([label, hint, key]) => (
            <label key={key} style={{ display: 'grid', gap: 4 }}>
              <span>{label} <span className="muted">({hint})</span></span>
              <input type="number" min={1} max={10} value={form[key] as number} onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))} />
            </label>
          ))}

          <select value={form.tool_decision as string} onChange={(e) => setForm((f) => ({ ...f, tool_decision: e.target.value }))}>
            <option value="create_new">create_new</option>
            <option value="adapt_existing">adapt_existing</option>
            <option value="reuse_existing">reuse_existing</option>
            <option value="no_tool">no_tool</option>
          </select>
          <textarea rows={2} placeholder="Tool notes / QA rationale" value={form.tool_notes as string} onChange={(e) => setForm((f) => ({ ...f, tool_notes: e.target.value }))} />
          <textarea rows={2} placeholder="Strengths" value={form.strengths as string} onChange={(e) => setForm((f) => ({ ...f, strengths: e.target.value }))} />
          <textarea rows={2} placeholder="Gaps" value={form.gaps as string} onChange={(e) => setForm((f) => ({ ...f, gaps: e.target.value }))} />
          <textarea rows={2} placeholder="Recommendations" value={form.recommendations as string} onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))} />

          <div className="muted">Core total: <strong>{totalCore}/60</strong> ({totalCore >= PASS_CORE ? 'PASS' : 'FAIL'})</div>
          <div className="muted">Governance total: <strong>{totalV2}/120</strong> ({totalV2 >= PASS_GOV ? 'PASS' : 'FAIL'})</div>
          <button type="submit">Save review</button>
        </form>
      </article>

      {/* ── Section 4: Linked Sources ────────── */}
      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Linked Sources ({sources.length})</h3>
        {sources.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Source</th><th>Topic</th><th>Headline</th><th>Role</th><th>Link</th></tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>{s.mc_source_updates?.mc_signal_sources?.name || '—'}</td>
                    <td>{s.mc_source_updates?.topic_area || '—'}</td>
                    <td>{s.mc_source_updates?.headline || '—'}</td>
                    <td>
                      <span style={{
                        padding: '2px 6px', borderRadius: 3, fontSize: 11,
                        background: s.source_role === 'primary' ? '#3b82f6' : s.source_role === 'evidence' ? '#8b5cf6' : '#475569',
                        color: '#fff',
                      }}>
                        {s.source_role}
                      </span>
                    </td>
                    <td>
                      {s.mc_source_updates?.url && (
                        <a href={s.mc_source_updates.url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12 }}>Open</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ opacity: 0.4, padding: 12 }}>No sources linked yet</div>
        )}
        <hr style={{ borderColor: '#2a3559', margin: '14px 0' }} />
        <h4 style={{ marginTop: 0 }}>Link source update</h4>
        <form onSubmit={linkSource} style={{ display: 'grid', gap: 8, maxWidth: 500 }}>
          <select value={sourceLink.source_update_id} onChange={(e) => setSourceLink((s) => ({ ...s, source_update_id: e.target.value }))} required>
            <option value="">Select source update</option>
            {sourceUpdates.map((su) => <option key={su.id} value={su.id}>{su.topic_area} — {su.headline}</option>)}
          </select>
          <select value={sourceLink.source_role} onChange={(e) => setSourceLink((s) => ({ ...s, source_role: e.target.value }))}>
            <option value="primary">primary</option>
            <option value="supporting">supporting</option>
            <option value="evidence">evidence</option>
          </select>
          <button type="submit">Link source</button>
        </form>
      </article>

      {/* ── Section 5: Review History ────────── */}
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Review History ({reviews.length})</h3>
        {reviews.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Reviewer</th><th>Core /60</th><th>Gov /120</th><th>Status</th></tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.reviewer}</td>
                    <td style={{ color: r.total_score >= PASS_CORE ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {r.total_score}
                    </td>
                    <td style={{ color: (r.total_score_v2 ?? 0) >= PASS_GOV ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {r.total_score_v2 ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${r.ready_to_publish ? 'good' : 'bad'}`}>
                        {r.ready_to_publish ? 'ready' : 'needs work'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ opacity: 0.4, padding: 12 }}>No reviews yet — use the form above to score this newsletter</div>
        )}
      </article>

      {/* ── Action Buttons ───────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {newsletter.pipeline_status !== 'published' && (
          <button onClick={advanceStage} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #10b981', background: '#10b981', color: '#fff', cursor: 'pointer' }}>
            Advance to {STAGE_LABELS[PIPELINE_ORDER[stageIdx + 1]] || 'Next'}
          </button>
        )}
        <a href={newsletter.url} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #2a3559', background: '#1e293b', color: '#60a5fa', textDecoration: 'none' }}>
          Open Live
        </a>
        {newsletter.tool_url && (
          <a href={newsletter.tool_url} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #2a3559', background: '#1e293b', color: '#60a5fa', textDecoration: 'none' }}>
            Open Tool
          </a>
        )}
      </div>
    </div>
  );
}
