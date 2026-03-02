'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageInfo from '@/components/ui/PageInfo';

/* ── types ───────────────────────────────────────────────── */

type ResearchItem = {
  id: string;
  created_at: string;
  source_url: string | null;
  content_type: string;
  title: string | null;
  summary: string | null;
  key_points: string[] | null;
  why_relevant: string | null;
  relevance_score: number | null;
  newsletter_angle: string | null;
  topic_area: string | null;
  agent_assessment: string | null;
  assessor_name: string | null;
  assessor_emoji: string | null;
  assessed_at: string | null;
  status: string;
  approved_for_draft: boolean;
  newsletter_id: string | null;
  newsletter_week: number | null;
  shared_by: string;
};

type Counts = {
  total: number;
  captured: number;
  assessing: number;
  assessed: number;
  approved: number;
  rejected: number;
  used: number;
};

/* ── constants ───────────────────────────────────────────── */

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'captured', label: 'New' },
  { key: 'assessed', label: 'Assessed' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const;

const CONTENT_TYPE_ICONS: Record<string, string> = {
  youtube: '▶️',
  article: '📰',
  govuk: '🏛️',
  pdf: '📄',
  social: '💬',
  manual: '✍️',
};

const TOPIC_COLORS: Record<string, string> = {
  finance: '#f59e0b',
  safeguarding: '#ef4444',
  ofsted: '#8b5cf6',
  estates: '#6b7280',
  attendance: '#3b82f6',
  send: '#ec4899',
  'ai-policy': '#22d3ee',
  governance: '#10b981',
  other: '#9fb0d9',
};

/* ── component ───────────────────────────────────────────── */

export default function ResearchPage() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, captured: 0, assessing: 0, assessed: 0, approved: 0, rejected: 0, used: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actioning, setActioning] = useState<string | null>(null);

  // Share content form
  const [shareUrl, setShareUrl] = useState('');
  const [shareTopic, setShareTopic] = useState('');
  const [shareNotes, setShareNotes] = useState('');
  const [sharing, setSharing] = useState(false);

  function loadItems() {
    setLoading(true);
    const params = filter !== 'all' ? `?status=${filter}` : '';
    fetch(`/api/research${params}`)
      .then(r => r.json())
      .then(d => {
        setItems(d.items || []);
        setCounts(d.counts || counts);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadItems(); }, [filter]);

  async function handleShare() {
    if (!shareUrl.trim()) return;
    setSharing(true);
    try {
      await fetch('/api/research/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: shareUrl,
          topic_hint: shareTopic || undefined,
          notes: shareNotes || undefined,
        }),
      });
      setShareUrl('');
      setShareTopic('');
      setShareNotes('');
      loadItems();
    } finally {
      setSharing(false);
    }
  }

  async function handleAction(id: string, action: 'approve' | 'reject' | 'deep_dive') {
    setActioning(id);
    try {
      if (action === 'approve' || action === 'reject') {
        await fetch(`/api/research/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' }),
        });
      }
      // Deep dive would queue a Hawk job — for now, approve/reject only
      loadItems();
    } finally {
      setActioning(null);
    }
  }

  function detectIcon(url: string): string {
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return '▶️';
    if (u.includes('gov.uk')) return '🏛️';
    if (u.endsWith('.pdf')) return '📄';
    return '📰';
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Research Feed</h1>
        <PageInfo
          title="Research"
          description="Research items captured by Scout and other agents. Raw intelligence gathered from sources, ready for newsletter curation."
          features={["View all captured research items", "Filter by status: captured, curated, used, discarded", "Click items to see full content and source", "Curated items flow into newsletter sections"]}
        />
      </div>
      <p className="page-sub">Capture, assess, and approve content for the newsletter</p>

      <div className="grid">
        {/* ── Share Content Form ────────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
            SHARE CONTENT
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="url"
                placeholder="Paste a URL — YouTube, gov.uk, article, PDF..."
                value={shareUrl}
                onChange={e => setShareUrl(e.target.value)}
                style={{ width: '100%', paddingLeft: 36 }}
                onKeyDown={e => e.key === 'Enter' && handleShare()}
              />
              <span style={{ position: 'absolute', left: 12, top: 11, fontSize: 16 }}>
                {shareUrl ? detectIcon(shareUrl) : '🔗'}
              </span>
            </div>
            <select value={shareTopic} onChange={e => setShareTopic(e.target.value)} style={{ width: 160 }}>
              <option value="">Topic (auto)</option>
              {Object.keys(TOPIC_COLORS).map(t => (
                <option key={t} value={t}>{t.replace('-', ' ')}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleShare} disabled={sharing || !shareUrl.trim()}>
              {sharing ? 'Capturing...' : 'Capture'}
            </button>
          </div>
          <input
            type="text"
            placeholder="Optional notes — why is this relevant?"
            value={shareNotes}
            onChange={e => setShareNotes(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* ── Filter Tabs ──────────────────────────────────── */}
        <div style={{ gridColumn: 'span 12', display: 'flex', gap: 4 }}>
          {STATUS_TABS.map(tab => {
            const count = tab.key === 'all' ? counts.total : counts[tab.key as keyof Counts] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  background: filter === tab.key ? 'rgba(110, 168, 254, 0.12)' : 'var(--panel-2)',
                  borderColor: filter === tab.key ? 'var(--accent)' : 'var(--line)',
                  color: filter === tab.key ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: filter === tab.key ? 600 : 400,
                }}
              >
                {tab.label} <span style={{ opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* ── Research Cards ───────────────────────────────── */}
        <div style={{ gridColumn: 'span 9', display: 'grid', gap: 10 }}>
          {loading ? (
            <div className="muted" style={{ padding: 20 }}>Loading research items...</div>
          ) : items.length === 0 ? (
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div className="muted">No research items{filter !== 'all' ? ` with status "${filter}"` : ''}.</div>
              <div className="muted" style={{ marginTop: 4 }}>Share a URL above to get started.</div>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>
                    {CONTENT_TYPE_ICONS[item.content_type] || '📎'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Link href={`/research/${item.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <strong style={{ fontSize: 15, cursor: 'pointer' }}>
                          {item.title || '(untitled)'}
                        </strong>
                      </Link>
                      {item.topic_area && (
                        <span className="badge" style={{
                          color: TOPIC_COLORS[item.topic_area] || 'var(--muted)',
                          borderColor: `${TOPIC_COLORS[item.topic_area] || 'var(--line)'}66`,
                          background: `${TOPIC_COLORS[item.topic_area] || 'var(--panel)'}15`,
                        }}>
                          {item.topic_area.replace('-', ' ')}
                        </span>
                      )}
                      <span className={`badge ${
                        item.status === 'approved' ? 'good' :
                        item.status === 'assessed' ? 'accent' :
                        item.status === 'rejected' ? 'bad' : ''
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Relevance score bar */}
                    {item.relevance_score && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{
                          height: 6, borderRadius: 3, flex: 1, maxWidth: 120,
                          background: 'var(--panel-2)',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${item.relevance_score * 10}%`,
                            background: item.relevance_score >= 7 ? 'var(--good)' :
                              item.relevance_score >= 5 ? 'var(--warn)' : 'var(--bad)',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {item.relevance_score}/10
                        </span>
                      </div>
                    )}

                    {/* Summary */}
                    {item.summary && (
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                        {item.summary}
                      </div>
                    )}

                    {/* Newsletter angle */}
                    {item.newsletter_angle && (
                      <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>
                        Angle: {item.newsletter_angle}
                      </div>
                    )}

                    {/* Assessment */}
                    {item.assessor_name && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {item.assessor_emoji} {item.assessor_name} assessed
                        {item.assessed_at ? ` on ${new Date(item.assessed_at).toLocaleDateString()}` : ''}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {(item.status === 'assessed' || item.status === 'captured') && (
                        <>
                          <button
                            className="btn-sm btn-primary"
                            onClick={() => handleAction(item.id, 'approve')}
                            disabled={actioning === item.id}
                          >
                            Approve for Draft
                          </button>
                          <button
                            className="btn-sm"
                            onClick={() => handleAction(item.id, 'reject')}
                            disabled={actioning === item.id}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                          <button className="btn-sm">View Source</button>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Right Sidebar: Stats ─────────────────────────── */}
        <div style={{ gridColumn: 'span 3', display: 'grid', gap: 10, alignContent: 'start' }}>
          <div className="card">
            <div className="muted">Total Items</div>
            <div className="kpi">{counts.total}</div>
          </div>
          <div className="card">
            <div className="muted">Avg Relevance</div>
            <div className="kpi">
              {items.length > 0
                ? (items.reduce((a, i) => a + (i.relevance_score || 0), 0) /
                    items.filter(i => i.relevance_score).length || 0
                  ).toFixed(1)
                : '—'}
            </div>
          </div>
          <div className="card">
            <div className="muted" style={{ marginBottom: 8 }}>By Topic</div>
            {Object.entries(
              items.reduce<Record<string, number>>((acc, i) => {
                const t = i.topic_area || 'other';
                acc[t] = (acc[t] || 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).map(([topic, count]) => (
              <div key={topic} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 13, padding: '3px 0',
              }}>
                <span style={{ color: TOPIC_COLORS[topic] || 'var(--muted)' }}>
                  {topic.replace('-', ' ')}
                </span>
                <span className="muted">{count}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="muted" style={{ marginBottom: 8 }}>By Source</div>
            {Object.entries(
              items.reduce<Record<string, number>>((acc, i) => {
                acc[i.content_type] = (acc[i.content_type] || 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 13, padding: '3px 0',
              }}>
                <span>{CONTENT_TYPE_ICONS[type]} {type}</span>
                <span className="muted">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
