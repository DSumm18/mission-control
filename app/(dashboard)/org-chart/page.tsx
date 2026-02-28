'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageInfo from '@/components/ui/PageInfo';

type OrgAgent = {
  agent_id: string;
  agent_name: string;
  role: string;
  default_engine: string;
  model_id: string | null;
  cost_tier: string | null;
  avatar_emoji: string | null;
  active: boolean;
  quality_score_avg: number;
  total_jobs_completed: number;
  consecutive_failures: number;
  department_id: string | null;
  department_name: string | null;
  department_slug: string | null;
  department_sort: number | null;
  reports_to_id: string | null;
  reports_to_name: string | null;
  notes?: string | null;
  skills?: string[];
};

type ChallengeBoard = {
  id: string;
  decision_title: string;
  decision_context: string | null;
  status: string;
  options: { label: string; summary: string; recommended_by?: string[] }[];
  final_decision: string | null;
  rationale: string | null;
  created_at: string;
  decided_at: string | null;
  mc_challenge_responses?: {
    id: string;
    perspective: string;
    position: string | null;
    argument: string | null;
    mc_agents: { name: string; notes: string | null; avatar_emoji: string | null } | null;
  }[];
};

function qualityBadge(score: number) {
  if (score >= 40) return 'good';
  if (score >= 25) return 'warn';
  return 'bad';
}

const EXEC_TITLES: Record<string, string> = {
  Kate: 'CFO',
  Kerry: 'CTO',
  Nic: 'COO',
  Jen: 'HR Director',
  Paul: 'Compliance',
  Alex: 'Education CEO',
  Helen: 'Marketing Director',
};

function statusColor(status: string) {
  if (status === 'decided') return 'good';
  if (status === 'deliberating') return 'warn';
  return 'accent';
}

function AgentCard({ a, isExec }: { a: OrgAgent; isExec: boolean }) {
  const title = EXEC_TITLES[a.agent_name];
  return (
    <Link href={`/agents/${a.agent_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={`org-agent-card ${isExec ? 'org-exec' : ''}`} style={{ opacity: a.active ? 1 : 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: isExec ? 26 : 20 }}>{a.avatar_emoji || '\u{1F916}'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: isExec ? 15 : 13 }}>
              {a.agent_name}
              {title && <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>({title})</span>}
            </div>
            {a.notes && (
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.3 }}>{a.notes}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 11, marginTop: 4 }}>
          <span className={`badge ${a.active ? 'good' : 'bad'}`} style={{ fontSize: 10 }}>
            {a.active ? 'active' : 'off'}
          </span>
          {a.quality_score_avg > 0 && (
            <span className={`badge ${qualityBadge(a.quality_score_avg)}`} style={{ fontSize: 10 }}>
              QA {a.quality_score_avg}
            </span>
          )}
          <span className="badge" style={{ fontSize: 10 }}>
            {a.total_jobs_completed} jobs
          </span>
          {a.cost_tier && <span className="badge" style={{ fontSize: 10 }}>{a.cost_tier}</span>}
        </div>
        {a.skills && a.skills.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
            {a.skills.map(s => (
              <span key={s} className="badge" style={{ fontSize: 9, padding: '1px 5px', opacity: 0.7 }}>
                {s}
              </span>
            ))}
          </div>
        )}
        {(!a.skills || a.skills.length === 0) && (
          <div className="muted" style={{ fontSize: 10, marginTop: 6, color: 'var(--bad)' }}>
            No tools assigned
          </div>
        )}
      </div>
    </Link>
  );
}

export default function OrgChartPage() {
  const [agents, setAgents] = useState<OrgAgent[]>([]);
  const [boards, setBoards] = useState<ChallengeBoard[]>([]);
  const [tab, setTab] = useState<'chart' | 'decisions'>('chart');

  useEffect(() => {
    fetch('/api/org-chart', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAgents(d.agents || []));
    fetch('/api/ed/challenge?limit=20', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setBoards(Array.isArray(d) ? d : []))
      .catch(() => setBoards([]));
  }, []);

  // Separate Ed (CEO), executives, and specialists
  const ed = agents.find(a => a.agent_name === 'Ed');
  const execNames = new Set(Object.keys(EXEC_TITLES));
  const executives = agents.filter(a => execNames.has(a.agent_name));
  const specialists = agents.filter(a => a.agent_name !== 'Ed' && !execNames.has(a.agent_name));

  // Group specialists by department
  const specByDept = new Map<string, OrgAgent[]>();
  for (const a of specialists) {
    const dept = a.department_name || 'Unassigned';
    const list = specByDept.get(dept) || [];
    list.push(a);
    specByDept.set(dept, list);
  }
  const sortedSpecDepts = [...specByDept.entries()].sort((a, b) => {
    const aSort = a[1][0]?.department_sort ?? 99;
    const bSort = b[1][0]?.department_sort ?? 99;
    return aSort - bSort;
  });

  // Decision stats
  const decidedBoards = boards.filter(b => b.status === 'decided');
  const openBoards = boards.filter(b => b.status === 'open' || b.status === 'deliberating');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Org Chart & Decision Board</h1>
        <PageInfo title="Org Chart" description="Visual hierarchy of your AI organization. See how agents are structured, their roles, and reporting lines." features={["Executive agents shown at the top with accent borders", "See each agent's role, engine, and status", "Click any agent card to view their full profile"]} />
      </div>
      <p className="page-sub">
        {agents.length} agents across {new Set(agents.map(a => a.department_name).filter(Boolean)).size} departments
        {' '}&middot; {openBoards.length} open decision{openBoards.length !== 1 ? 's' : ''}
        {' '}&middot; {decidedBoards.length} decided
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
        <button
          onClick={() => setTab('chart')}
          style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
            color: tab === 'chart' ? 'var(--fg)' : 'var(--muted)',
            borderBottom: tab === 'chart' ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: tab === 'chart' ? 600 : 400,
          }}
        >
          Organisation
        </button>
        <button
          onClick={() => setTab('decisions')}
          style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
            color: tab === 'decisions' ? 'var(--fg)' : 'var(--muted)',
            borderBottom: tab === 'decisions' ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: tab === 'decisions' ? 600 : 400,
          }}
        >
          Challenge Board
          {openBoards.length > 0 && (
            <span className="badge warn" style={{ marginLeft: 6, fontSize: 10 }}>{openBoards.length}</span>
          )}
        </button>
      </div>

      {tab === 'chart' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* CEO */}
          {ed && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 280 }}>
                <AgentCard a={ed} isExec />
              </div>
            </div>
          )}

          {/* Connector line */}
          {ed && executives.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 2, height: 20, background: 'var(--line)' }} />
            </div>
          )}

          {/* C-Suite Row */}
          {executives.length > 0 && (
            <div className="card">
              <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
                C-Suite Executives
                <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                  Report to Ed &middot; Challenge Board participants
                </span>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {executives.map(a => <AgentCard key={a.agent_id} a={a} isExec />)}
              </div>
            </div>
          )}

          {/* Connector line */}
          {executives.length > 0 && specialists.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 2, height: 20, background: 'var(--line)' }} />
            </div>
          )}

          {/* Specialist Teams */}
          {sortedSpecDepts.map(([deptName, deptAgents]) => (
            <div key={deptName} className="card">
              <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
                {deptName}
                <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                  {deptAgents.length} specialist{deptAgents.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {deptAgents.map(a => <AgentCard key={a.agent_id} a={a} isExec={false} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'decisions' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Open boards */}
          {openBoards.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, margin: 0 }}>Open Decisions</h2>
              {openBoards.map(board => (
                <BoardCard key={board.id} board={board} />
              ))}
            </>
          )}

          {/* Decided boards */}
          {decidedBoards.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, margin: '12px 0 0' }}>Decision History</h2>
              {decidedBoards.map(board => (
                <BoardCard key={board.id} board={board} />
              ))}
            </>
          )}

          {boards.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{'\u2696\uFE0F'}</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No challenge boards yet</div>
              <div className="muted">Ask Ed to create one: &quot;Should we launch MyMeme for Mother&apos;s Day?&quot;</div>
            </div>
          )}

          {/* Decision Quality Summary */}
          {decidedBoards.length >= 2 && (
            <div className="card">
              <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Decision Quality Metrics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, fontSize: 13 }}>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>Total Decisions</div>
                  <div style={{ fontWeight: 600, fontSize: 20 }}>{decidedBoards.length}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>Avg Responses/Board</div>
                  <div style={{ fontWeight: 600, fontSize: 20 }}>
                    {decidedBoards.length > 0
                      ? (decidedBoards.reduce((s, b) => s + (b.mc_challenge_responses?.length || 0), 0) / decidedBoards.length).toFixed(1)
                      : '0'}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>With Rationale</div>
                  <div style={{ fontWeight: 600, fontSize: 20 }}>
                    {decidedBoards.filter(b => b.rationale).length}/{decidedBoards.length}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>Unique Challengers</div>
                  <div style={{ fontWeight: 600, fontSize: 20 }}>
                    {new Set(
                      decidedBoards.flatMap(b => (b.mc_challenge_responses || []).map(r => r.mc_agents?.name).filter(Boolean))
                    ).size}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BoardCard({ board }: { board: ChallengeBoard }) {
  const [expanded, setExpanded] = useState(false);
  const responses = board.mc_challenge_responses || [];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{board.decision_title}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            {new Date(board.created_at).toLocaleDateString()} &middot;{' '}
            {responses.length} response{responses.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {board.final_decision && (
            <span className="badge good" style={{ fontSize: 12 }}>
              Decision: {board.final_decision}
            </span>
          )}
          <span className={`badge ${statusColor(board.status)}`} style={{ fontSize: 11 }}>
            {board.status}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {/* Context */}
          {board.decision_context && (
            <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
              {board.decision_context}
            </div>
          )}

          {/* Options */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Options</div>
            {board.options.map((opt, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13,
                fontWeight: board.final_decision === opt.label ? 600 : 400,
                color: board.final_decision === opt.label ? 'var(--good)' : 'inherit',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700,
                  background: board.final_decision === opt.label ? 'var(--good)' : 'var(--accent)',
                  color: 'var(--bg)',
                }}>
                  {opt.label}
                </span>
                {opt.summary}
                {opt.recommended_by && opt.recommended_by.length > 0 && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    ({opt.recommended_by.join(', ')})
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Executive Responses */}
          {responses.length > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Executive Responses</div>
              {responses.map(r => (
                <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{r.mc_agents?.avatar_emoji || '\u{1F916}'}</span>
                    <strong>{r.mc_agents?.name || 'Unknown'}</strong>
                    <span className="badge" style={{ fontSize: 10 }}>{r.perspective}</span>
                    {r.position && (
                      <span className="badge accent" style={{ fontSize: 10 }}>Option {r.position}</span>
                    )}
                  </div>
                  {r.argument && (
                    <div style={{ marginTop: 4, paddingLeft: 26, color: 'var(--muted)', lineHeight: 1.4 }}>
                      {r.argument}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rationale */}
          {board.rationale && (
            <div style={{ padding: '10px 16px', fontSize: 12 }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>David&apos;s Rationale</div>
              <div>{board.rationale}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
