'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Item = {
  id: string;
  title: string;
  week_no: number | null;
  issue_type: 'newsletter' | 'tool' | 'resource';
  url: string;
  notes: string | null;
  total_score: number | null;
  ready_to_publish: boolean | null;
  reviewed_at: string | null;
};

const rubric = [
  ['Value for money', 'Can a head/SLT justify this spend to governors?'],
  ['School relevance', 'Directly solves current school/trust priorities'],
  ['Actionability', 'Clear actions schools can do this week'],
  ['Clarity', 'Simple, non-jargon, no ambiguity'],
  ['Differentiation', 'Clearly better than generic updates'],
  ['Human voice quality', 'Does not read as AI-written'],
] as const;

export default function NewslettersPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [threshold, setThreshold] = useState(44);
  const [form, setForm] = useState({
    newsletter_id: '',
    reviewer: 'Ed',
    value_for_money_score: 7,
    school_relevance_score: 7,
    actionability_score: 7,
    clarity_score: 7,
    differentiation_score: 7,
    anti_ai_voice_score: 7,
    strengths: '',
    gaps: '',
    recommendations: '',
  });

  async function load() {
    const r = await fetch('/api/newsletters', { cache: 'no-store' });
    const d = await r.json();
    setItems(d.items || []);
    setThreshold(d.threshold || 44);
    if (!form.newsletter_id && d.items?.[0]?.id) {
      setForm((f) => ({ ...f, newsletter_id: d.items[0].id }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const total = useMemo(
    () =>
      form.value_for_money_score +
      form.school_relevance_score +
      form.actionability_score +
      form.clarity_score +
      form.differentiation_score +
      form.anti_ai_voice_score,
    [form]
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
    alert(`Saved. Total score ${data.review.total_score}/60 (${data.review.ready_to_publish ? 'READY' : 'NOT READY'})`);
  }

  return (
    <div>
      <h1 className="page-title">Newsletter Quality Gate</h1>
      <p className="page-sub">Review newsletters/tools against a school-value rubric. Pass threshold: {threshold}/60.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0 }}>Links + Current Readiness</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Type</th><th>Title</th><th>Link</th><th>Score</th><th>Status</th><th>Reviewed</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.issue_type}</td>
                    <td>{i.title}</td>
                    <td><a href={i.url} target="_blank" rel="noreferrer">Open</a></td>
                    <td>{i.total_score ?? '—'}</td>
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
            <select value={form.newsletter_id} onChange={(e) => setForm((f) => ({ ...f, newsletter_id: e.target.value }))} required>
              <option value="">Select item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
            <input value={form.reviewer} onChange={(e) => setForm((f) => ({ ...f, reviewer: e.target.value }))} placeholder="Reviewer" />

            {rubric.map(([label, hint], idx) => {
              const keys = [
                'value_for_money_score',
                'school_relevance_score',
                'actionability_score',
                'clarity_score',
                'differentiation_score',
                'anti_ai_voice_score',
              ] as const;
              const key = keys[idx];
              return (
                <label key={label} style={{ display: 'grid', gap: 4 }}>
                  <span>{label} <span className="muted">({hint})</span></span>
                  <input type="number" min={1} max={10} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))} />
                </label>
              );
            })}

            <textarea rows={3} placeholder="Strengths" value={form.strengths} onChange={(e) => setForm((f) => ({ ...f, strengths: e.target.value }))} />
            <textarea rows={3} placeholder="Gaps" value={form.gaps} onChange={(e) => setForm((f) => ({ ...f, gaps: e.target.value }))} />
            <textarea rows={3} placeholder="Recommendations" value={form.recommendations} onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))} />

            <div className="muted">Live total: <strong>{total}/60</strong> ({total >= threshold ? 'READY' : 'NOT READY'})</div>
            <button type="submit">Save review</button>
          </form>
        </article>
      </section>
    </div>
  );
}
