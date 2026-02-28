'use client';

import { useEffect, useState } from 'react';
import PageInfo from '@/components/ui/PageInfo';

type Run = {
  id: string;
  created_at: string;
  job_id: string | null;
  agent_name: string | null;
  agent_role: string | null;
  engine: string;
  model_used: string | null;
  status: string;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  estimated_cost_usd: number | null;
  error_summary: string | null;
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    fetch('/api/runs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setRuns(d.runs || []));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Run Ledger</h1>
        <PageInfo title="Runs" description="Execution history for all agent runs. Lower-level view than Jobs — shows individual run attempts, retries, and timing." features={["See raw execution data per run", "Track retries and failure patterns", "Duration and cost per individual run"]} />
      </div>
      <p className="page-sub">Who ran what, on which model, at what cost, with what outcome.</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Agent</th><th>Role</th><th>Engine</th><th>Model</th><th>Status</th><th>Duration</th><th>Cost</th><th>Error</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.agent_name || '—'}</td>
                <td>{r.agent_role || '—'}</td>
                <td>{r.engine}</td>
                <td>{r.model_used || '—'}</td>
                <td><span className={`badge ${r.status === 'done' ? 'good' : r.status.includes('paused') || r.status === 'running' || r.status === 'queued' ? 'warn' : 'bad'}`}>{r.status}</span></td>
                <td>{r.duration_ms ? `${Math.round(r.duration_ms/1000)}s` : '—'}</td>
                <td>{typeof r.estimated_cost_usd === 'number' ? `$${r.estimated_cost_usd.toFixed(4)}` : '—'}</td>
                <td>{r.error_summary || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
