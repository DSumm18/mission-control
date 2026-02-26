'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
};

function qualityBadge(score: number) {
  if (score >= 40) return 'good';
  if (score >= 25) return 'warn';
  return 'bad';
}

export default function OrgChartPage() {
  const [agents, setAgents] = useState<OrgAgent[]>([]);

  useEffect(() => {
    fetch('/api/org-chart', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAgents(d.agents || []));
  }, []);

  // Group by department
  const departments = new Map<string, OrgAgent[]>();
  const noDept: OrgAgent[] = [];

  for (const a of agents) {
    if (a.department_name) {
      const list = departments.get(a.department_name) || [];
      list.push(a);
      departments.set(a.department_name, list);
    } else {
      noDept.push(a);
    }
  }

  // Sort departments by sort_order
  const sortedDepts = [...departments.entries()].sort((a, b) => {
    const aSort = a[1][0]?.department_sort ?? 99;
    const bSort = b[1][0]?.department_sort ?? 99;
    return aSort - bSort;
  });

  return (
    <div>
      <h1 className="page-title">Org Chart</h1>
      <p className="page-sub">Department hierarchy with agent assignments, quality scores, and active status.</p>

      <div style={{ display: 'grid', gap: 20 }}>
        {sortedDepts.map(([deptName, deptAgents]) => (
          <div key={deptName} className="card">
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>
              {deptName}
              <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                {deptAgents.length} agent{deptAgents.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {deptAgents.map((a) => (
                <Link
                  key={a.agent_id}
                  href={`/agents/${a.agent_id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      padding: 12,
                      background: 'rgba(255,255,255,0.02)',
                      opacity: a.active ? 1 : 0.5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 22 }}>{a.avatar_emoji || '🤖'}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.agent_name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{a.role} • {a.default_engine}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                      <span className={`badge ${a.active ? 'good' : 'bad'}`}>
                        {a.active ? 'active' : 'inactive'}
                      </span>
                      {a.quality_score_avg > 0 && (
                        <span className={`badge ${qualityBadge(a.quality_score_avg)}`}>
                          QA: {a.quality_score_avg}
                        </span>
                      )}
                      {a.cost_tier && (
                        <span className="badge">{a.cost_tier}</span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                      {a.total_jobs_completed} jobs done
                      {a.reports_to_name ? ` • reports to ${a.reports_to_name}` : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {noDept.length > 0 && (
          <div className="card">
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Unassigned</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {noDept.map((a) => (
                <div key={a.agent_id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{a.avatar_emoji || '🤖'} {a.agent_name}</div>
                  <div className="muted">{a.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
