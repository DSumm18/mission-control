'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Milestone = {
  name: string;
  target: string;
  status: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  delivery_plan: { milestones?: Milestone[] };
  status: string;
  revenue_target_monthly: number | null;
  mc_agents: { id: string; name: string; avatar_emoji: string | null } | null;
};

type Job = {
  id: string;
  title: string;
  status: string;
  quality_score: number | null;
  agent_id: string | null;
  created_at: string;
  job_type: string;
};

function statusBadge(status: string) {
  if (status === 'done' || status === 'active') return 'good';
  if (status === 'in_progress' || status === 'paused' || status === 'queued' || status === 'running' || status === 'reviewing') return 'warn';
  return 'bad';
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/projects/${params.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setProject(d.project || null);
        setJobs(d.jobs || []);
        if (d.project?.delivery_plan) {
          setEditPlan(JSON.stringify(d.project.delivery_plan, null, 2));
        }
      });
  }, [params.id]);

  async function savePlan() {
    if (!project) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(editPlan);
      await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_plan: parsed }),
      });
      const res = await fetch(`/api/projects/${params.id}`, { cache: 'no-store' });
      const d = await res.json();
      setProject(d.project || null);
    } catch {
      alert('Invalid JSON');
    } finally {
      setSaving(false);
    }
  }

  if (!project) {
    return <div><h1 className="page-title">Loading...</h1></div>;
  }

  const milestones = project.delivery_plan?.milestones || [];

  return (
    <div>
      <Link href="/projects" style={{ fontSize: 13 }}>&larr; Back to Projects</Link>
      <h1 className="page-title" style={{ marginTop: 8 }}>{project.name}</h1>
      <p className="page-sub">
        {project.description || 'No description'}
        {project.mc_agents ? ` • PM: ${project.mc_agents.avatar_emoji || '🤖'} ${project.mc_agents.name}` : ''}
        {project.revenue_target_monthly ? ` • Target: £${project.revenue_target_monthly.toLocaleString()}/mo` : ''}
      </p>

      {/* Milestone Timeline */}
      {milestones.length > 0 && (
        <section className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Milestones</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Milestone</th><th>Target Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr key={i}>
                    <td>{m.name}</td>
                    <td>{m.target}</td>
                    <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid" style={{ marginBottom: 14 }}>
        {/* Delivery Plan Editor */}
        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Delivery Plan (JSON)</h3>
          <textarea
            value={editPlan}
            onChange={(e) => setEditPlan(e.target.value)}
            rows={12}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
          />
          <button onClick={savePlan} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Saving...' : 'Save Plan'}
          </button>
        </article>

        {/* Job Stats */}
        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Job History ({jobs.length})</h3>
          {jobs.length === 0 ? (
            <p className="muted">No jobs for this project yet</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Status</th><th>QA</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.title}</td>
                      <td>{j.job_type}</td>
                      <td><span className={`badge ${statusBadge(j.status)}`}>{j.status}</span></td>
                      <td>
                        {j.quality_score !== null ? (
                          <span className={`badge ${j.quality_score >= 35 ? 'good' : 'bad'}`}>
                            {j.quality_score}/50
                          </span>
                        ) : '—'}
                      </td>
                      <td>{new Date(j.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
