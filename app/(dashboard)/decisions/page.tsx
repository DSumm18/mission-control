'use client';

import { useEffect, useState } from 'react';

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
    risk_flags: { risk: string; severity: string; mitigation: string }[];
    mc_agents: { name: string; notes: string | null; avatar_emoji: string | null } | null;
  }[];
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  task_type?: string;
  assigned_to?: string;
};

function statusColor(status: string) {
  if (status === 'decided') return 'good';
  if (status === 'deliberating') return 'warn';
  if (status === 'open') return 'accent';
  return '';
}

function severityBadge(severity: string) {
  if (severity === 'high') return 'bad';
  if (severity === 'medium') return 'warn';
  return 'good';
}

export default function DecisionsPage() {
  const [boards, setBoards] = useState<ChallengeBoard[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'decided'>('all');

  useEffect(() => {
    fetch('/api/ed/challenge?limit=50', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setBoards(Array.isArray(d) ? d : []))
      .catch(() => setBoards([]));
    fetch('/api/tasks', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const all = d.tasks || d || [];
        setTasks(all.filter((t: Task) => t.assigned_to === 'david' && (t.status === 'todo' || t.status === 'in_progress')));
      })
      .catch(() => setTasks([]));
  }, []);

  const openBoards = boards.filter(b => b.status === 'open' || b.status === 'deliberating');
  const decidedBoards = boards.filter(b => b.status === 'decided');
  const filtered = filter === 'open' ? openBoards : filter === 'decided' ? decidedBoards : boards;

  return (
    <div>
      <h1 className="page-title">Decisions Inbox</h1>
      <p className="page-sub">
        Challenge board debates, pending sign-offs, and decision history.
      </p>

      {/* David's pending tasks */}
      {tasks.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--accent)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Your Pending Sign-Offs</h3>
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 500 }}>{t.title}</span>
                {t.task_type && <span className="badge" style={{ marginLeft: 8, fontSize: 10 }}>{t.task_type}</span>}
              </div>
              <span className="badge warn" style={{ fontSize: 10 }}>priority {t.priority}</span>
            </div>
          ))}
          <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
            Tell Ed &quot;approve [task name]&quot; to sign off via voice or text.
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'open', 'decided'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 14px', border: '1px solid var(--line)', borderRadius: 6,
              background: filter === f ? 'var(--accent)' : 'transparent',
              color: filter === f ? 'var(--bg)' : 'var(--fg)',
              cursor: 'pointer', fontSize: 12, fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f === 'all' ? `All (${boards.length})` : f === 'open' ? `Open (${openBoards.length})` : `Decided (${decidedBoards.length})`}
          </button>
        ))}
      </div>

      {/* Boards */}
      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(board => {
          const responses = board.mc_challenge_responses || [];
          return (
            <div key={board.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{'\u2696\uFE0F'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{board.decision_title}</span>
                    <span className={`badge ${statusColor(board.status)}`} style={{ fontSize: 10 }}>
                      {board.status}
                    </span>
                  </div>
                  {board.decision_context && (
                    <div className="muted" style={{ fontSize: 12, marginLeft: 28, lineHeight: 1.4 }}>
                      {board.decision_context}
                    </div>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  {new Date(board.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Options */}
              <div style={{ borderTop: '1px solid var(--line)', padding: '10px 16px' }}>
                {board.options.map((opt, i) => {
                  const isChosen = board.final_decision === opt.label;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13,
                      color: isChosen ? 'var(--good)' : 'inherit', fontWeight: isChosen ? 600 : 400,
                    }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%', fontSize: 12, fontWeight: 700, flexShrink: 0,
                        background: isChosen ? 'var(--good)' : 'var(--accent)', color: 'var(--bg)',
                      }}>
                        {opt.label}
                      </span>
                      <span style={{ flex: 1 }}>{opt.summary}</span>
                      {opt.recommended_by && opt.recommended_by.length > 0 && (
                        <span className="muted" style={{ fontSize: 11 }}>
                          {opt.recommended_by.join(', ')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Responses */}
              {responses.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '10px 16px' }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Executive Responses</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {responses.map(r => (
                      <div key={r.id} style={{ fontSize: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span>{r.mc_agents?.avatar_emoji || '\u{1F916}'}</span>
                          <strong>{r.mc_agents?.name}</strong>
                          <span className="badge" style={{ fontSize: 10 }}>{r.perspective}</span>
                          {r.position && <span className="badge accent" style={{ fontSize: 10 }}>Option {r.position}</span>}
                        </div>
                        {r.argument && <div className="muted" style={{ lineHeight: 1.4 }}>{r.argument}</div>}
                        {r.risk_flags && r.risk_flags.length > 0 && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {r.risk_flags.map((rf, j) => (
                              <span key={j} className={`badge ${severityBadge(rf.severity)}`} style={{ fontSize: 10 }}>
                                {rf.risk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decided rationale */}
              {board.status === 'decided' && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '10px 16px', background: 'rgba(61,220,151,0.03)' }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>Decision: Option {board.final_decision}</strong>
                    {board.rationale && <span className="muted"> &mdash; {board.rationale}</span>}
                  </div>
                  {board.decided_at && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      Decided {new Date(board.decided_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{'\u2696\uFE0F'}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {filter === 'open' ? 'No open decisions' : filter === 'decided' ? 'No decisions yet' : 'No challenge boards yet'}
            </div>
            <div className="muted">
              Ask Ed to create one: &quot;Should we launch MyMeme for Mother&apos;s Day?&quot;
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
