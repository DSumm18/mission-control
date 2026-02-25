'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CostRow = {
  engine: 'claude' | 'gemini' | 'openai' | 'shell' | string;
  runs: number;
  est_cost_usd: number;
  avg_duration_ms: number | null;
};

type RunRow = {
  id: string;
  created_at: string;
  agent_name: string | null;
  engine: string;
  model_used: string | null;
  status: string;
  estimated_cost_usd: number | null;
};

export default function HomePage() {
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);

  useEffect(() => {
    fetch('/api/costs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCosts(d.costs || []))
      .catch(() => setCosts([]));

    fetch('/api/runs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setRuns(d.runs || []))
      .catch(() => setRuns([]));
  }, []);

  const totals = useMemo(() => {
    const totalRuns = costs.reduce((a, c) => a + Number(c.runs || 0), 0);
    const totalCost = costs.reduce((a, c) => a + Number(c.est_cost_usd || 0), 0);
    const running = runs.filter((r) => r.status === 'running').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    return { totalRuns, totalCost, running, failed };
  }, [costs, runs]);

  return (
    <div>
      <h1 className="page-title">Mission Control v1</h1>
      <p className="page-sub">Live orchestration snapshot: agents, model runs, and cost telemetry.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Runs (7d)</div>
          <div className="kpi">{totals.totalRuns}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Estimated Cost (7d)</div>
          <div className="kpi">${totals.totalCost.toFixed(4)}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Currently Running</div>
          <div className="kpi">{totals.running}</div>
        </article>
        <article className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted">Failed (recent)</div>
          <div className="kpi">{totals.failed}</div>
        </article>
      </section>

      <section className="grid" style={{ marginBottom: 14 }}>
        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Cost by Engine (7d)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Engine</th><th>Runs</th><th>Est. Cost</th><th>Avg Duration</th></tr>
              </thead>
              <tbody>
                {costs.length === 0 && (
                  <tr><td colSpan={4} className="muted">No run cost data yet.</td></tr>
                )}
                {costs.map((c) => (
                  <tr key={c.engine}>
                    <td>{c.engine}</td>
                    <td>{c.runs}</td>
                    <td>${Number(c.est_cost_usd || 0).toFixed(4)}</td>
                    <td>{c.avg_duration_ms ? `${Math.round(Number(c.avg_duration_ms) / 1000)}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Recent Runs</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Agent</th><th>Engine</th><th>Status</th><th>Cost</th></tr>
              </thead>
              <tbody>
                {runs.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td>{r.agent_name || '—'}</td>
                    <td>{r.engine}</td>
                    <td>
                      <span className={`badge ${r.status === 'done' ? 'good' : r.status.includes('paused') || r.status === 'running' || r.status === 'queued' ? 'warn' : 'bad'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{typeof r.estimated_cost_usd === 'number' ? `$${r.estimated_cost_usd.toFixed(4)}` : '—'}</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr><td colSpan={5} className="muted">No runs recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid">
        <article className="card" style={{ gridColumn: 'span 12' }}>
          <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
          <ul>
            <li><Link href="/agents">Agents</Link> — role/mode ownership</li>
            <li><Link href="/skills">Skills</Link> — tool inventory and posture</li>
            <li><Link href="/runs">Runs</Link> — model/agent/cost audit trail</li>
            <li><Link href="/jobs">Jobs</Link> — queue execution</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
