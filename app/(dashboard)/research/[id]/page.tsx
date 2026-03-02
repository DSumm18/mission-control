'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastContext';

type ResearchItem = {
  id: string;
  created_at: string;
  updated_at: string | null;
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
  shared_by: string | null;
  raw_content: string | null;
  transcript_text: string | null;
  capture_job_id: string | null;
  assessment_job_id: string | null;
};

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

function statusBadge(s: string) {
  if (s === 'approved' || s === 'used') return 'good';
  if (s === 'rejected') return 'bad';
  if (s === 'assessed') return 'accent';
  return 'warn';
}

function scoreColor(score: number) {
  if (score >= 7) return 'var(--good)';
  if (score >= 5) return 'var(--warn)';
  return 'var(--bad)';
}

function ts(v: string | null) {
  if (!v) return '--';
  return new Date(v).toLocaleString();
}

export default function ResearchDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [contentTab, setContentTab] = useState<'content' | 'transcript'>('content');
  const [acting, setActing] = useState(false);

  function loadItem() {
    if (!params.id) return;
    fetch(`/api/research/${params.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setItem(d.item || null));
  }

  useEffect(() => { loadItem(); }, [params.id]);

  async function updateStatus(status: string) {
    setActing(true);
    try {
      const res = await fetch(`/api/research/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast(d.error || 'Failed', 'bad');
        return;
      }
      toast(status === 'approved' ? 'Approved for draft' : status === 'rejected' ? 'Rejected' : 'Updated', 'good');
      loadItem();
    } finally {
      setActing(false);
    }
  }

  if (!item) {
    return (
      <div>
        <Link href="/research" style={{ color: 'var(--accent)', fontSize: 13 }}>&larr; Back to Research</Link>
        <h1 className="page-title" style={{ marginTop: 8 }}>Loading...</h1>
      </div>
    );
  }

  const icon = CONTENT_TYPE_ICONS[item.content_type] || '📎';
  const hasContent = !!item.raw_content;
  const hasTranscript = !!item.transcript_text;
  const keyPoints = Array.isArray(item.key_points) ? item.key_points : [];

  return (
    <div>
      <Link href="/research" style={{ color: 'var(--accent)', fontSize: 13 }}>&larr; Back to Research</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ margin: 0 }}>{item.title || '(untitled)'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
            {item.topic_area && (
              <span className="badge" style={{
                color: TOPIC_COLORS[item.topic_area] || 'var(--muted)',
                borderColor: `${TOPIC_COLORS[item.topic_area] || 'var(--line)'}66`,
                background: `${TOPIC_COLORS[item.topic_area] || 'var(--panel)'}15`,
              }}>
                {item.topic_area.replace('-', ' ')}
              </span>
            )}
            {item.relevance_score != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(item.relevance_score) }}>
                {item.relevance_score}/10
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Status</div>
          <div className="kpi"><span className={`badge ${statusBadge(item.status)}`} style={{ fontSize: 16 }}>{item.status}</span></div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Relevance</div>
          <div style={{ marginTop: 8 }}>
            {item.relevance_score != null ? (
              <>
                <div style={{
                  height: 8, borderRadius: 4,
                  background: 'var(--panel-2)',
                  marginBottom: 6,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${item.relevance_score * 10}%`,
                    background: scoreColor(item.relevance_score),
                  }} />
                </div>
                <div className="kpi" style={{ color: scoreColor(item.relevance_score) }}>{item.relevance_score}/10</div>
              </>
            ) : (
              <div className="kpi" style={{ color: 'var(--muted)' }}>--</div>
            )}
          </div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Content Type</div>
          <div className="kpi" style={{ fontSize: 22 }}>{icon} {item.content_type}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Topic</div>
          <div className="kpi" style={{
            fontSize: 18,
            color: item.topic_area ? (TOPIC_COLORS[item.topic_area] || 'var(--muted)') : 'var(--muted)',
          }}>
            {item.topic_area ? item.topic_area.replace('-', ' ') : 'Untagged'}
          </div>
        </article>
      </section>

      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(item.status === 'assessed' || item.status === 'captured') && (
          <>
            <button className="btn-primary" onClick={() => updateStatus('approved')} disabled={acting}>
              Approve for Draft
            </button>
            <button onClick={() => updateStatus('rejected')} disabled={acting}>
              Reject
            </button>
          </>
        )}
        {item.status === 'rejected' && (
          <button className="btn-primary" onClick={() => updateStatus('assessed')} disabled={acting}>
            Unreject
          </button>
        )}
        {item.source_url && (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer">
            <button>Open Source</button>
          </a>
        )}
      </div>

      {/* Main content */}
      <section className="grid" style={{ marginBottom: 14 }}>
        {/* Left: content viewer */}
        <div style={{ gridColumn: 'span 8', display: 'grid', gap: 14 }}>
          {/* Content viewer */}
          <article className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Content</h3>
              {hasContent && hasTranscript && (
                <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                  <button
                    className="btn-sm"
                    onClick={() => setContentTab('content')}
                    style={{
                      background: contentTab === 'content' ? 'rgba(110,168,254,0.12)' : undefined,
                      color: contentTab === 'content' ? 'var(--accent)' : undefined,
                    }}
                  >
                    Article
                  </button>
                  <button
                    className="btn-sm"
                    onClick={() => setContentTab('transcript')}
                    style={{
                      background: contentTab === 'transcript' ? 'rgba(110,168,254,0.12)' : undefined,
                      color: contentTab === 'transcript' ? 'var(--accent)' : undefined,
                    }}
                  >
                    Transcript
                  </button>
                </div>
              )}
            </div>

            {(hasContent || hasTranscript) ? (
              <div style={{
                maxHeight: 600, overflow: 'auto',
                background: 'var(--panel-2)', padding: 14, borderRadius: 6,
                fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {contentTab === 'transcript' && hasTranscript
                  ? item.transcript_text
                  : (item.raw_content || item.transcript_text)}
              </div>
            ) : (
              <div className="muted" style={{ padding: 30, textAlign: 'center' }}>
                No content captured.
                {item.source_url && (
                  <> <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>View original source &rarr;</a></>
                )}
              </div>
            )}
          </article>

          {/* Assessment */}
          {(item.summary || item.agent_assessment || keyPoints.length > 0) && (
            <article className="card">
              <h3 style={{ margin: '0 0 12px' }}>Assessment</h3>

              {item.summary && (
                <div style={{ marginBottom: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Summary</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{item.summary}</div>
                </div>
              )}

              {keyPoints.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Key Points</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                    {keyPoints.map((p, i) => <li key={i}>{typeof p === 'string' ? p : JSON.stringify(p)}</li>)}
                  </ul>
                </div>
              )}

              {item.why_relevant && (
                <div style={{ marginBottom: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Why Relevant</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{item.why_relevant}</div>
                </div>
              )}

              {item.newsletter_angle && (
                <div style={{ marginBottom: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Newsletter Angle</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--accent)' }}>{item.newsletter_angle}</div>
                </div>
              )}

              {item.agent_assessment && (
                <div style={{ marginBottom: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Agent Assessment</div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.6,
                    background: 'var(--panel-2)', padding: 10, borderRadius: 6,
                  }}>
                    {item.agent_assessment}
                  </div>
                </div>
              )}

              {item.assessor_name && (
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {item.assessor_emoji} Assessed by {item.assessor_name}
                  {item.assessed_at ? ` on ${new Date(item.assessed_at).toLocaleDateString()}` : ''}
                </div>
              )}
            </article>
          )}
        </div>

        {/* Right: details sidebar */}
        <article className="card" style={{ gridColumn: 'span 4' }}>
          <h3 style={{ margin: '0 0 12px' }}>Details</h3>
          <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
            {item.source_url && (
              <div>
                <div className="muted">Source URL</div>
                <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>
                  {item.source_url.length > 60 ? item.source_url.slice(0, 60) + '...' : item.source_url}
                </a>
              </div>
            )}
            <div>
              <div className="muted">Content Type</div>
              <div>{icon} {item.content_type}</div>
            </div>
            <div>
              <div className="muted">Topic Area</div>
              <div style={{ color: item.topic_area ? TOPIC_COLORS[item.topic_area] : 'var(--muted)' }}>
                {item.topic_area ? item.topic_area.replace('-', ' ') : 'Untagged'}
              </div>
            </div>
            {item.shared_by && (
              <div>
                <div className="muted">Shared By</div>
                <div>{item.shared_by}</div>
              </div>
            )}
            {item.newsletter_week && (
              <div>
                <div className="muted">Newsletter</div>
                <div>Week {item.newsletter_week}</div>
              </div>
            )}
            <div>
              <div className="muted">Approved for Draft</div>
              <div>{item.approved_for_draft ? 'Yes' : 'No'}</div>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div className="muted">Created</div>
              <div>{ts(item.created_at)}</div>
            </div>
            {item.updated_at && (
              <div>
                <div className="muted">Updated</div>
                <div>{ts(item.updated_at)}</div>
              </div>
            )}
            {item.capture_job_id && (
              <div>
                <div className="muted">Capture Job</div>
                <Link href={`/jobs/${item.capture_job_id}`} style={{ color: 'var(--accent)' }}>
                  View job &rarr;
                </Link>
              </div>
            )}
            {item.assessment_job_id && (
              <div>
                <div className="muted">Assessment Job</div>
                <Link href={`/jobs/${item.assessment_job_id}`} style={{ color: 'var(--accent)' }}>
                  View job &rarr;
                </Link>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
