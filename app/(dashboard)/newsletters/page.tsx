'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Item = {
  id: string;
  title: string;
  week_no: number | null;
  issue_type: 'newsletter' | 'tool' | 'resource';
  url: string;
  notes: string | null;
  summary?: string | null;
  topic_category?: string | null;
  tool_decision?: string | null;
  tool_name?: string | null;
  source_updates_count?: number;
  total_score: number | null;
  total_score_v2?: number | null;
  ready_to_publish: boolean | null;
  reviewed_at: string | null;
};

type SourceUpdate = { id: string; headline: string; topic_area: string };

const rubricCore = [
  ['Value for money', 'Can a head/SLT justify this spend to governors?', 'value_for_money_score'],
  ['School relevance', 'Directly solves current school/trust priorities', 'school_relevance_score'],
  ['Actionability', 'Clear actions schools can do this week', 'actionability_score'],
  ['Clarity', 'Simple, non-jargon, no ambiguity', 'clarity_score'],
  ['Differentiation', 'Clearly better than generic updates', 'differentiation_score'],
  ['Human voice quality', 'Does not read as AI-written', 'anti_ai_voice_score'],
] as const;

const rubricGovernance = [
  ['Source specificity', 'Specific update/topic identified (not vague source label)', 'source_specificity_score'],
  ['Source transparency', 'Sources are visible and attributable', 'source_transparency_score'],
  ['Evidence linkage', 'Data point links to source/dataset trail', 'evidence_linking_score'],
  ['Tool viability', 'Tool choice is realistic for this issue', 'tool_viability_score'],
  ['Tool QA confidence', 'Linked tool has been validated', 'tool_qa_score'],
  ['Compliance confidence', 'Regulatory defensibility is clear', 'compliance_confidence_score'],
] as const;

export default function NewslettersPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [sourceUpdates, setSourceUpdates] = useState<SourceUpdate[]>([]);
  const [threshold, setThreshold] = useState(44);
  const [thresholdV2, setThresholdV2] = useState(78);
  const [form, setForm] = useState<any>({
    newsletter_id: '',
    reviewer: 'Ed',
    value_for_money_score: 7,
    school_relevance_score: 7,
    actionability_score: 7,
    clarity_score: 7,
    differentiation_score: 7,
    anti_ai_voice_score: 7,
    source_specificity_score: 7,
    source_transparency_score: 7,
    evidence_linking_score: 7,
    tool_viability_score: 7,
    tool_qa_score: 7,
    compliance_confidence_score: 7,
    tool_decision: 'reuse_existing',
    tool_notes: '',
    strengths: '',
    gaps: '',
    recommendations: '',
  });
  const [sourceLink, setSourceLink] = useState({ newsletter_id: '', source_update_id: '', source_role: 'supporting' });

  async function load() {
    const [n, su] = await Promise.all([
      fetch('/api/newsletters', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/sources/updates', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ updates: [] })),
    ]);
    setItems(n.items || []);
    setThreshold(n.threshold || 44);
    setThresholdV2(n.thresholdV2 || 78);
    setSourceUpdates(su.updates || []);
    if (!form.newsletter_id && n.items?.[0]?.id) {
      setForm((f: any) => ({ ...f, newsletter_id: n.items[0].id }));
      setSourceLink((s) => ({ ...s, newsletter_id: n.items[0].id }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalCore = useMemo(
    () => rubricCore.reduce((acc, [, , key]) => acc + Number(form[key] || 0), 0),
    [form]
  );

  const totalV2 = useMemo(
    () => totalCore + rubricGovernance.reduce((acc, [, , key]) => acc + Number(form[key] || 0), 0),
    [form, totalCore]
  );

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/newsletters/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Review failed');
      return;
    }
    await load();
    alert(`Saved. Core ${data.review.total_score}/60, Governance ${data.review.total_score_v2}/120 (${data.review.ready_to_publish ? 'READY' : 'NOT READY'})`);
  }

  async function linkSource(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/newsletters/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sourceLink),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Link failed');
    await load();
    alert('Source linked to newsletter');
  }

  return (
    <div>
      <h1 className="page-title">Newsletter Quality Gate</h1>
      <p className="page-sub">Scoring includes content quality, source governance, and tool QA. Thresholds: {threshold}/60 core + {thresholdV2}/120 governance.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0 }}>Links + Current Readiness</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Type</th><th>Title</th><th>Topic</th><th>Tool</th><th>Sources</th><th>Link</th><th>Core</th><th>Gov</th><th>Status</th><th>Reviewed</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.issue_type}</td>
                    <td>{i.title}</td>
                    <td>{i.topic_category || '—'}</td>
                    <td>{i.tool_name || i.tool_decision || '—'}</td>
                    <td>{i.source_updates_count ?? 0}</td>
                    <td><a href={i.url} target="_blank" rel="noreferrer">Open</a></td>
                    <td>{i.total_score ?? '—'}</td>
                    <td>{i.total_score_v2 ?? '—'}</td>
                    <td>
                      {i.ready_to_publish === null ? (
                        <span className="badge warn">unscored</span>
                      ) : i.ready_to_publish ? (
                        <span className="badge good">ready</span>
                      ) : (
                        <span className="badge bad">needs work</span>
                      )}
                    </td>
                    <td>{i.reviewed_at ? new Date(i.reviewed_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0 }}>Score a Newsletter/Tool</h3>
          <form onSubmit={submitReview} style={{ display: 'grid', gap: 8 }}>
            <select value={form.newsletter_id} onChange={(e) => { const v=e.target.value; setForm((f:any)=>({ ...f, newsletter_id: v })); setSourceLink(s=>({ ...s, newsletter_id: v })); }} required>
              <option value="">Select item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
            <input value={form.reviewer} onChange={(e) => setForm((f: any) => ({ ...f, reviewer: e.target.value }))} placeholder="Reviewer" />

            <h4 style={{ margin: '6px 0 0' }}>Core quality (60)</h4>
            {rubricCore.map(([label, hint, key]) => (
              <label key={key} style={{ display: 'grid', gap: 4 }}>
                <span>{label} <span className="muted">({hint})</span></span>
                <input type="number" min={1} max={10} value={form[key]} onChange={(e) => setForm((f: any) => ({ ...f, [key]: Number(e.target.value) }))} />
              </label>
            ))}

            <h4 style={{ margin: '6px 0 0' }}>Source/tool governance (+60)</h4>
            {rubricGovernance.map(([label, hint, key]) => (
              <label key={key} style={{ display: 'grid', gap: 4 }}>
                <span>{label} <span className="muted">({hint})</span></span>
                <input type="number" min={1} max={10} value={form[key]} onChange={(e) => setForm((f: any) => ({ ...f, [key]: Number(e.target.value) }))} />
              </label>
            ))}

            <select value={form.tool_decision} onChange={(e) => setForm((f: any) => ({ ...f, tool_decision: e.target.value }))}>
              <option value="create_new">create_new</option>
              <option value="adapt_existing">adapt_existing</option>
              <option value="reuse_existing">reuse_existing</option>
              <option value="no_tool">no_tool</option>
            </select>
            <textarea rows={2} placeholder="Tool notes / QA rationale" value={form.tool_notes} onChange={(e) => setForm((f: any) => ({ ...f, tool_notes: e.target.value }))} />
            <textarea rows={2} placeholder="Strengths" value={form.strengths} onChange={(e) => setForm((f: any) => ({ ...f, strengths: e.target.value }))} />
            <textarea rows={2} placeholder="Gaps" value={form.gaps} onChange={(e) => setForm((f: any) => ({ ...f, gaps: e.target.value }))} />
            <textarea rows={2} placeholder="Recommendations" value={form.recommendations} onChange={(e) => setForm((f: any) => ({ ...f, recommendations: e.target.value }))} />

            <div className="muted">Core total: <strong>{totalCore}/60</strong> ({totalCore >= threshold ? 'PASS' : 'FAIL'})</div>
            <div className="muted">Governance total: <strong>{totalV2}/120</strong> ({totalV2 >= thresholdV2 ? 'PASS' : 'FAIL'})</div>
            <button type="submit">Save review</button>
          </form>

          <hr style={{ borderColor: '#2a3559', margin: '14px 0' }} />
          <h4 style={{ marginTop: 0 }}>Link source update to this newsletter</h4>
          <form onSubmit={linkSource} style={{ display: 'grid', gap: 8 }}>
            <select value={sourceLink.source_update_id} onChange={(e)=>setSourceLink(s=>({ ...s, source_update_id: e.target.value }))} required>
              <option value="">Select source update</option>
              {sourceUpdates.map(su => <option key={su.id} value={su.id}>{su.topic_area} — {su.headline}</option>)}
            </select>
            <select value={sourceLink.source_role} onChange={(e)=>setSourceLink(s=>({ ...s, source_role: e.target.value }))}>
              <option value="primary">primary</option>
              <option value="supporting">supporting</option>
              <option value="evidence">evidence</option>
            </select>
            <button type="submit">Link source</button>
          </form>
        </article>
      </section>
    </div>
  );
}
