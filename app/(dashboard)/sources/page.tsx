'use client';

import { FormEvent, useEffect, useState } from 'react';

type Source = { id: string; name: string; source_type: string; check_cadence: string; reliability_score: number };
type Update = { id: string; headline: string; topic_area: string; url: string; verified_official: boolean; impact_score: number; mc_signal_sources?: { name?: string } };

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [form, setForm] = useState({
    source_id: '', topic_area: 'finance', headline: '', summary: '', url: '', dataset_name: '', verified_official: false, potential_newsletter_angle: '', impact_score: 6,
  });

  async function load() {
    const [s,u] = await Promise.all([
      fetch('/api/sources', { cache: 'no-store' }).then(r=>r.json()),
      fetch('/api/sources/updates', { cache: 'no-store' }).then(r=>r.json()),
    ]);
    setSources(s.sources || []);
    setUpdates(u.updates || []);
    if (!form.source_id && s.sources?.[0]?.id) setForm(f => ({ ...f, source_id: s.sources[0].id }));
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/sources/updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Failed');
    setForm(f => ({ ...f, headline: '', summary: '', url: '', potential_newsletter_angle: '' }));
    await load();
  }

  return (
    <div>
      <h1 className="page-title">Signal Sources + Updates</h1>
      <p className="page-sub">Track specific topic updates (not vague source labels) to drive newsletter planning.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0 }}>Add Source Update</h3>
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
            <select value={form.source_id} onChange={e => setForm(f => ({ ...f, source_id: e.target.value }))} required>
              <option value="">Select source</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={form.topic_area} onChange={e => setForm(f => ({ ...f, topic_area: e.target.value }))}>
              {['finance','safeguarding','ofsted','estates','attendance','send','ai-policy','governance','other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Specific headline/update" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} required />
            <input placeholder="Source URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required />
            <input placeholder="Dataset name (optional)" value={form.dataset_name} onChange={e => setForm(f => ({ ...f, dataset_name: e.target.value }))} />
            <textarea rows={3} placeholder="Summary" value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
            <textarea rows={2} placeholder="Newsletter angle" value={form.potential_newsletter_angle} onChange={e => setForm(f => ({ ...f, potential_newsletter_angle: e.target.value }))} />
            <label><input type="checkbox" checked={form.verified_official} onChange={e => setForm(f => ({ ...f, verified_official: e.target.checked }))} /> Verified official</label>
            <input type="number" min={1} max={10} value={form.impact_score} onChange={e => setForm(f => ({ ...f, impact_score: Number(e.target.value) }))} />
            <button type="submit">Save update</button>
          </form>
        </article>

        <article className="card" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0 }}>Recent Source Updates</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Source</th><th>Topic</th><th>Headline</th><th>Official</th><th>Impact</th><th>Link</th></tr></thead>
              <tbody>
                {updates.map(u => (
                  <tr key={u.id}>
                    <td>{u.mc_signal_sources?.name || '—'}</td>
                    <td>{u.topic_area}</td>
                    <td>{u.headline}</td>
                    <td><span className={`badge ${u.verified_official ? 'good' : 'warn'}`}>{u.verified_official ? 'yes' : 'no'}</span></td>
                    <td>{u.impact_score}</td>
                    <td><a href={u.url} target="_blank" rel="noreferrer">Open</a></td>
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
