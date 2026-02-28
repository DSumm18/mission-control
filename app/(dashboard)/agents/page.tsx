'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageInfo from '@/components/ui/PageInfo';

type Agent = {
  id: string;
  name: string;
  role: string;
  default_engine: string;
  fallback_engine: string | null;
  model_hint: string | null;
  model_id: string | null;
  active: boolean;
  notes: string | null;
  cost_tier: string | null;
  avatar_emoji: string | null;
  quality_score_avg: number;
  total_jobs_completed: number;
  mc_departments: { id: string; name: string; slug: string } | null;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch('/api/agents', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAgents(d.agents || []));
  }, []);

  // Group by department
  const departments = new Map<string, Agent[]>();
  const noDept: Agent[] = [];
  for (const a of agents) {
    const deptName = a.mc_departments?.name || '';
    if (deptName) {
      const list = departments.get(deptName) || [];
      list.push(a);
      departments.set(deptName, list);
    } else {
      noDept.push(a);
    }
  }

  const allGroups = [...departments.entries()];
  if (noDept.length > 0) allGroups.push(['Unassigned', noDept]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Agents</h1>
        <PageInfo title="Agents" description="Your AI workforce. Each agent has a role, an engine, and performance metrics. Monitor quality scores, failure rates, and job history." features={["Status dots show which agents are actively running jobs", "Quality scores track output quality over time", "Click an agent to see full detail and job history", "Toggle agents active/inactive as needed"]} />
      </div>
      <p className="page-sub">Role-based orchestration roster grouped by department.</p>

      {allGroups.map(([deptName, deptAgents]) => (
        <div key={deptName} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>{deptName}</h2>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Role</th>
                  <th>Engine</th>
                  <th>Model</th>
                  <th>Cost</th>
                  <th>Quality Avg</th>
                  <th>Jobs Done</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deptAgents.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/agents/${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{a.avatar_emoji || '🤖'}</span>
                        <span>{a.name}</span>
                      </Link>
                    </td>
                    <td>{a.role}</td>
                    <td>{a.default_engine}</td>
                    <td style={{ fontSize: 12 }}>{a.model_id || a.model_hint || '—'}</td>
                    <td>{a.cost_tier || '—'}</td>
                    <td>
                      {a.quality_score_avg > 0 ? (
                        <span className={`badge ${a.quality_score_avg >= 35 ? 'good' : a.quality_score_avg >= 20 ? 'warn' : 'bad'}`}>
                          {a.quality_score_avg}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{a.total_jobs_completed}</td>
                    <td>
                      <span className={`badge ${a.active ? 'good' : 'bad'}`}>
                        {a.active ? 'active' : 'inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
