'use client';

import { useEffect, useState } from 'react';

type Agent = {
  id: string;
  name: string;
  role: string;
  default_engine: string;
  fallback_engine: string | null;
  model_hint: string | null;
  active: boolean;
  notes: string | null;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch('/api/agents', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAgents(d.agents || []));
  }, []);

  return (
    <div>
      <h1 className="page-title">Agents</h1>
      <p className="page-sub">Role-based orchestration roster. This is where delivery responsibility is assigned.</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Primary Engine</th><th>Fallback</th><th>Model Hint</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.role}</td>
                <td>{a.default_engine}</td>
                <td>{a.fallback_engine || '—'}</td>
                <td>{a.model_hint || '—'}</td>
                <td><span className={`badge ${a.active ? 'good' : 'bad'}`}>{a.active ? 'active' : 'inactive'}</span></td>
                <td>{a.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
