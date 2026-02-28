'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastContext';

type PipelineJob = {
  job_id: string;
  title: string;
  status: string;
  engine: string;
  priority: number;
  job_type: string;
  source: string;
  quality_score: number | null;
  review_notes: string | null;
  parent_job_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agent_id: string | null;
  agent_name: string | null;
  agent_emoji: string | null;
  department_name: string | null;
  project_id: string | null;
  project_name: string | null;
};

const COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'queued', label: 'Queued', statuses: ['queued'] },
  { key: 'assigned', label: 'Assigned', statuses: ['assigned'] },
  { key: 'running', label: 'Running', statuses: ['running'] },
  { key: 'reviewing', label: 'Reviewing', statuses: ['reviewing'] },
  { key: 'done', label: 'Done', statuses: ['done'] },
  { key: 'rejected', label: 'Rejected', statuses: ['rejected'] },
  { key: 'failed', label: 'Failed', statuses: ['failed'] },
];

function priorityColor(p: number) {
  if (p <= 2) return 'bad';
  if (p <= 5) return 'warn';
  return 'good';
}

function typeBadgeColor(t: string) {
  if (t === 'review') return 'warn';
  if (t === 'decomposition' || t === 'integration') return 'good';
  return '';
}

export default function PipelinePage() {
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchJobs = useCallback(() => {
    fetch('/api/jobs/pipeline', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30_000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  async function handleDrop(jobId: string, newStatus: string) {
    // Optimistic update
    setJobs(prev => prev.map(j =>
      j.job_id === jobId ? { ...j, status: newStatus } : j
    ));

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Failed to update', 'bad');
        fetchJobs(); // Revert
      } else {
        toast(`Job moved to ${newStatus}`, 'good');
      }
    } catch {
      toast('Network error', 'bad');
      fetchJobs();
    }
  }

  return (
    <div>
      <h1 className="page-title">Pipeline</h1>
      <p className="page-sub">Kanban view — drag cards between columns to update status.</p>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {COLUMNS.map((col) => {
          const colJobs = jobs.filter((j) => col.statuses.includes(j.status));
          const isOver = dragOver === col.key;
          return (
            <div
              key={col.key}
              className={isOver ? 'drag-over' : ''}
              style={{
                minWidth: 240,
                maxWidth: 280,
                flex: '0 0 auto',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 10,
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                if (dragging) {
                  const targetStatus = col.statuses[0];
                  handleDrop(dragging, targetStatus);
                }
                setDragging(null);
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{col.label}</span>
                <span className="muted">{colJobs.length}</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {colJobs.slice(0, 20).map((job) => (
                  <div
                    key={job.job_id}
                    draggable
                    onDragStart={() => setDragging(job.job_id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    className={`${job.status === 'running' ? 'card-running' : ''} ${dragging === job.job_id ? 'dragging-card' : ''}`}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: 10,
                      background: 'var(--panel)',
                      fontSize: 13,
                      cursor: 'grab',
                      transition: 'opacity 0.15s ease, transform 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                      {job.title}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className={`badge ${priorityColor(job.priority)}`}>
                        P{job.priority}
                      </span>
                      {job.job_type !== 'task' && (
                        <span className={`badge ${typeBadgeColor(job.job_type)}`}>
                          {job.job_type}
                        </span>
                      )}
                      {job.source !== 'dashboard' && (
                        <span className="badge">{job.source}</span>
                      )}
                    </div>
                    {job.agent_name && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {job.agent_emoji || '\uD83E\uDD16'}{' '}
                        <Link href={`/agents/${job.agent_id}`} style={{ color: 'var(--accent)' }}>
                          {job.agent_name}
                        </Link>
                      </div>
                    )}
                    {job.project_name && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {job.project_name}
                      </div>
                    )}
                    {job.status === 'running' && job.started_at && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        {'\u23F1'} {Math.round((Date.now() - new Date(job.started_at).getTime()) / 60000)}m elapsed
                      </div>
                    )}
                    {job.quality_score !== null && (
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        <span className={`badge ${job.quality_score >= 35 ? 'good' : 'bad'}`}>
                          QA: {job.quality_score}/50
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {colJobs.length > 20 && (
                  <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
                    +{colJobs.length - 20} more
                  </div>
                )}
                {colJobs.length === 0 && (
                  <div className="muted" style={{ fontSize: 12, textAlign: 'center', padding: 16 }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
