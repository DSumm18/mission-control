'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageInfo from '@/components/ui/PageInfo';

/* ── types ───────────────────────────────────────────────── */

type PipelineItem = {
  id: string;
  title: string;
  week_no: number | null;
  pipeline_status: string;
  topic_category: string | null;
  research_count: number;
  approved_research: number;
  draft_count: number;
  latest_version: number | null;
  event_count: number;
};

type ResearchItem = {
  id: string;
  title: string | null;
  status: string;
  relevance_score: number | null;
  content_type: string;
  topic_area: string | null;
  created_at: string;
};

type RecentJob = {
  id: string;
  title: string;
  status: string;
  engine: string;
  agent_name: string | null;
  agent_emoji: string | null;
  completed_at: string | null;
};

type NeedsAttention = {
  research_awaiting_approval: number;
  research_new: number;
  drafts_awaiting_review: number;
  drafts_in_review: number;
};

type ResearchCounts = {
  total: number;
  captured: number;
  assessed: number;
  approved: number;
  rejected: number;
};

type ThisWeekData = {
  pipeline: PipelineItem[];
  research: ResearchItem[];
  researchCounts: ResearchCounts;
  recentJobs: RecentJob[];
  needsAttention: NeedsAttention;
};

/* ── pipeline stage config ───────────────────────────────── */

const PIPELINE_STAGES = [
  { key: 'research', label: 'Research', emoji: '🔍' },
  { key: 'draft', label: 'Draft', emoji: '✏️' },
  { key: 'app_build', label: 'App Build', emoji: '🔧' },
  { key: 'qa_review', label: 'QA', emoji: '🛡️' },
  { key: 'published', label: 'Publish', emoji: '🚀' },
] as const;

const STAGE_COLORS: Record<string, string> = {
  research: '#8b5cf6',
  draft: '#f59e0b',
  app_build: '#3b82f6',
  qa_review: '#ec4899',
  approved: '#10b981',
  published: '#22d3ee',
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
  youtube: '▶️',
  article: '📰',
  govuk: '🏛️',
  pdf: '📄',
  social: '💬',
  manual: '✍️',
};

/* ── component ───────────────────────────────────────────── */

export default function ThisWeekPage() {
  const [data, setData] = useState<ThisWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetch('/api/this-week')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function handleShareContent() {
    if (!shareUrl.trim()) return;
    setSharing(true);
    try {
      await fetch('/api/research/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: shareUrl }),
      });
      setShareUrl('');
      // Refresh data
      const r = await fetch('/api/this-week');
      setData(await r.json());
    } finally {
      setSharing(false);
    }
  }

  if (loading) return <p className="muted">Loading command centre...</p>;
  if (!data) return <p className="muted">Failed to load data.</p>;

  // Determine current week's newsletter (highest week_no in pipeline)
  const current = data.pipeline.length > 0
    ? data.pipeline.reduce((a, b) => (a.week_no || 0) >= (b.week_no || 0) ? a : b)
    : null;

  // Count newsletters at each stage
  const stageCounts: Record<string, number> = {};
  for (const item of data.pipeline) {
    stageCounts[item.pipeline_status] = (stageCounts[item.pipeline_status] || 0) + 1;
  }

  const totalAttention =
    data.needsAttention.research_awaiting_approval +
    data.needsAttention.research_new +
    data.needsAttention.drafts_awaiting_review +
    data.needsAttention.drafts_in_review;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">This Week</h1>
        <PageInfo title="This Week's Newsletter" description="Preview of the current week's Schoolgle Signal newsletter. See the latest draft with all sections assembled." features={["Live preview of the newsletter draft", "Sections pulled from research and content pipeline", "Track publish status and quality scores"]} />
      </div>
      <p className="page-sub">
        {current
          ? `Week ${current.week_no} — ${current.title}`
          : 'No active newsletter in pipeline'}
      </p>

      <div className="grid">
        {/* ── Node Pipeline Visual ─────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--muted)' }}>
            PIPELINE
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0,
            position: 'relative',
          }}>
            {/* Connector line */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '10%',
              right: '10%',
              height: 2,
              background: 'var(--line)',
              zIndex: 0,
            }} />

            {PIPELINE_STAGES.map((stage) => {
              const count = stageCounts[stage.key] || 0;
              const isActive = current?.pipeline_status === stage.key;
              const isPast = current
                ? PIPELINE_STAGES.findIndex(s => s.key === current.pipeline_status) >
                  PIPELINE_STAGES.findIndex(s => s.key === stage.key)
                : false;

              let bgColor = 'var(--panel-2)';
              let borderColor = 'var(--line)';
              if (isActive) {
                bgColor = `${STAGE_COLORS[stage.key]}22`;
                borderColor = STAGE_COLORS[stage.key];
              } else if (isPast) {
                bgColor = 'rgba(61, 220, 151, 0.08)';
                borderColor = 'var(--good)';
              }

              return (
                <div key={stage.key} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 1,
                  flex: 1,
                }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    border: `2px solid ${borderColor}`,
                    background: bgColor,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    transition: 'all 0.2s ease',
                  }}>
                    {stage.emoji}
                    {count > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{count}</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 12,
                    marginTop: 6,
                    color: isActive ? STAGE_COLORS[stage.key] : 'var(--muted)',
                    fontWeight: isActive ? 600 : 400,
                  }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── KPI Row ──────────────────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Research Found</div>
          <div className="kpi">{data.researchCounts.total}</div>
          <div className="muted">{data.researchCounts.approved} approved</div>
        </div>
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Draft Version</div>
          <div className="kpi">{current?.latest_version ? `v${current.latest_version}` : '—'}</div>
          <div className="muted">{current?.draft_count || 0} drafts</div>
        </div>
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Needs Attention</div>
          <div className="kpi" style={{ color: totalAttention > 0 ? 'var(--warn)' : 'var(--good)' }}>
            {totalAttention}
          </div>
          <div className="muted">items requiring action</div>
        </div>
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Pipeline Events</div>
          <div className="kpi">{current?.event_count || 0}</div>
          <div className="muted">stage transitions</div>
        </div>

        {/* ── Needs Attention Panel ────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
            NEEDS ATTENTION
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.needsAttention.research_new > 0 && (
              <Link href="/research?status=captured" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 10, background: 'var(--panel-2)',
                border: '1px solid var(--line)', textDecoration: 'none',
              }}>
                <span>New research to assess</span>
                <span className="badge warn">{data.needsAttention.research_new}</span>
              </Link>
            )}
            {data.needsAttention.research_awaiting_approval > 0 && (
              <Link href="/research?status=assessed" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 10, background: 'var(--panel-2)',
                border: '1px solid var(--line)', textDecoration: 'none',
              }}>
                <span>Research awaiting approval</span>
                <span className="badge accent">{data.needsAttention.research_awaiting_approval}</span>
              </Link>
            )}
            {data.needsAttention.drafts_awaiting_review > 0 && (
              <Link href="/content-studio" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 10, background: 'var(--panel-2)',
                border: '1px solid var(--line)', textDecoration: 'none',
              }}>
                <span>Drafts awaiting review</span>
                <span className="badge warn">{data.needsAttention.drafts_awaiting_review}</span>
              </Link>
            )}
            {totalAttention === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--good)', fontSize: 14 }}>
                All clear — nothing needs your attention right now.
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ────────────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
            QUICK ACTIONS
          </div>
          {/* Share Content */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="url"
              placeholder="Paste a URL to share..."
              value={shareUrl}
              onChange={e => setShareUrl(e.target.value)}
              style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && handleShareContent()}
            />
            <button className="btn-primary" onClick={handleShareContent} disabled={sharing || !shareUrl.trim()}>
              {sharing ? 'Sharing...' : 'Share'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/research">
              <button className="btn-sm">Research Feed</button>
            </Link>
            <Link href="/content-studio">
              <button className="btn-sm">Content Studio</button>
            </Link>
            <Link href="/newsletters">
              <button className="btn-sm">QA Gate</button>
            </Link>
          </div>
        </div>

        {/* ── Recent Research ──────────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 7' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
            RECENT RESEARCH
          </div>
          {data.research.length === 0 ? (
            <div className="muted">No research items yet. Share a URL above to get started.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {data.research.slice(0, 8).map(item => (
                <Link key={item.id} href={`/research?highlight=${item.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, background: 'var(--panel-2)',
                  border: '1px solid var(--line)', textDecoration: 'none', fontSize: 13,
                }}>
                  <span>{CONTENT_TYPE_ICONS[item.content_type] || '📎'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || '(untitled)'}
                  </span>
                  {item.relevance_score && (
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: item.relevance_score >= 7 ? 'var(--good)' : item.relevance_score >= 5 ? 'var(--warn)' : 'var(--muted)',
                    }}>
                      {item.relevance_score}/10
                    </span>
                  )}
                  <span className={`badge ${
                    item.status === 'approved' ? 'good' :
                    item.status === 'assessed' ? 'accent' :
                    item.status === 'rejected' ? 'bad' : ''
                  }`}>
                    {item.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Agent Activity Feed ──────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 5' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
            AGENT ACTIVITY
          </div>
          {data.recentJobs.length === 0 ? (
            <div className="muted">No recent newsletter jobs.</div>
          ) : (
            <div>
              {data.recentJobs.map(job => (
                <div key={job.id} className="feed-item">
                  <div className="feed-dot" style={{ background: 'var(--good)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>
                      <span>{job.agent_emoji || '🤖'} </span>
                      <strong>{job.agent_name || 'Agent'}</strong>
                      <span className="muted" style={{ marginLeft: 4 }}>{job.engine}</span>
                    </div>
                    <div className="muted" style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {job.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
