'use client';

import { useEffect, useState } from 'react';

/* ── types ───────────────────────────────────────────────── */

type Newsletter = {
  id: string;
  title: string;
  week_no: number | null;
  pipeline_status: string;
  draft_version: string | null;
  tool_name: string | null;
  tool_url: string | null;
  snippet_url: string | null;
  url: string | null;
  total_score_v2: number | null;
  ready_to_publish: boolean | null;
};

/* ── component ───────────────────────────────────────────── */

export default function PublishPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [selected, setSelected] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [genSocial, setGenSocial] = useState(false);

  useEffect(() => {
    fetch('/api/newsletters')
      .then(r => r.json())
      .then(d => {
        const items = (d.items || []).filter(
          (n: Newsletter) => n.pipeline_status === 'approved' || n.pipeline_status === 'published'
        );
        setNewsletters(items);
        const readyItem = items.find((n: Newsletter) => n.pipeline_status === 'approved');
        if (readyItem) setSelected(readyItem);
        else if (items.length > 0) setSelected(items[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handlePublish() {
    if (!selected) return;
    setPublishing(true);
    try {
      await fetch(`/api/newsletters/${selected.id}/publish`, { method: 'POST' });
      // Refresh
      const r = await fetch('/api/newsletters');
      const d = await r.json();
      const items = (d.items || []).filter(
        (n: Newsletter) => n.pipeline_status === 'approved' || n.pipeline_status === 'published'
      );
      setNewsletters(items);
    } finally {
      setPublishing(false);
    }
  }

  async function handleGenerateSocial() {
    if (!selected) return;
    setGenSocial(true);
    try {
      // This would queue Megaphone to generate social copy
      // For now, just mark the action
      await new Promise(r => setTimeout(r, 1000));
    } finally {
      setGenSocial(false);
    }
  }

  if (loading) return <p className="muted">Loading...</p>;

  const gateChecks = selected ? [
    { label: 'QA Passed', ok: (selected.total_score_v2 || 0) >= 78 },
    { label: 'Draft Approved', ok: selected.pipeline_status === 'approved' || selected.pipeline_status === 'published' },
    { label: 'Tool Built', ok: !!selected.tool_url },
  ] : [];

  const allGatesPassed = gateChecks.every(g => g.ok);

  return (
    <>
      <h1 className="page-title">Publish</h1>
      <p className="page-sub">Final review, social copy, and publish to GitHub Pages</p>

      <div className="grid">
        {/* ── Newsletter Selector ──────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 12', display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selected?.id || ''}
            onChange={e => setSelected(newsletters.find(n => n.id === e.target.value) || null)}
            style={{ minWidth: 300 }}
          >
            <option value="">Select newsletter to publish...</option>
            {newsletters.map(n => (
              <option key={n.id} value={n.id}>
                {n.title} — {n.pipeline_status}
              </option>
            ))}
          </select>

          {selected?.pipeline_status === 'published' && (
            <span className="badge good">Published</span>
          )}
          {selected?.pipeline_status === 'approved' && (
            <span className="badge accent">Ready to Publish</span>
          )}
        </div>

        {selected ? (
          <>
            {/* ── Publish Gate Checks ──────────────────────── */}
            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
                PUBLISH GATES
              </div>
              {gateChecks.map(check => (
                <div key={check.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid var(--line)',
                }}>
                  <span style={{ fontSize: 18 }}>{check.ok ? '✅' : '⬜'}</span>
                  <span style={{ color: check.ok ? 'var(--good)' : 'var(--muted)' }}>
                    {check.label}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <button
                  className="btn-primary"
                  onClick={handlePublish}
                  disabled={publishing || !allGatesPassed || selected.pipeline_status === 'published'}
                  style={{ width: '100%' }}
                >
                  {publishing ? 'Publishing...' : selected.pipeline_status === 'published' ? 'Already Published' : 'Publish Newsletter'}
                </button>
              </div>
            </div>

            {/* ── Newsletter Info ──────────────────────────── */}
            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
                NEWSLETTER DETAILS
              </div>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div><span className="muted">Week:</span> {selected.week_no || '—'}</div>
                <div><span className="muted">Draft:</span> {selected.draft_version || '—'}</div>
                <div><span className="muted">QA Score:</span> {selected.total_score_v2 ? `${selected.total_score_v2}/120` : '—'}</div>
                <div><span className="muted">Tool:</span> {selected.tool_name || '—'}</div>
                {selected.url && (
                  <div>
                    <span className="muted">Live URL: </span>
                    <a href={selected.url} target="_blank" rel="noopener noreferrer">View</a>
                  </div>
                )}
                {selected.tool_url && (
                  <div>
                    <span className="muted">Tool URL: </span>
                    <a href={selected.tool_url} target="_blank" rel="noopener noreferrer">View</a>
                  </div>
                )}
              </div>
            </div>

            {/* ── Social Copy ──────────────────────────────── */}
            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
                SOCIAL COPY
              </div>
              <button
                className="btn-sm"
                onClick={handleGenerateSocial}
                disabled={genSocial}
                style={{ marginBottom: 12 }}
              >
                {genSocial ? 'Generating...' : 'Generate Social Posts'}
              </button>
              <div className="muted" style={{ fontSize: 12 }}>
                Megaphone will generate X + LinkedIn posts based on the newsletter content.
              </div>
            </div>
          </>
        ) : (
          <div className="card" style={{ gridColumn: 'span 12', textAlign: 'center', padding: 40 }}>
            <div className="muted">No newsletters ready to publish. Complete QA review first.</div>
          </div>
        )}
      </div>
    </>
  );
}
