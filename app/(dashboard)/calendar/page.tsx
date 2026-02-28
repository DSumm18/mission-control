'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import PageInfo from '@/components/ui/PageInfo';

type DayStats = {
  date: string;
  total: number;
  done: number;
  failed: number;
  running: number;
  jobs: { id: string; title: string; status: string; engine: string }[];
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dotColor(status: string): string {
  if (status === 'done') return 'var(--good)';
  if (status === 'failed') return 'var(--bad)';
  if (['running', 'queued', 'assigned'].includes(status)) return 'var(--accent)';
  return 'var(--warn)';
}

export default function CalendarPage() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [weeks, setWeeks] = useState(4);
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/stats/calendar?weeks=${weeks}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setDays(d.days || []))
      .catch(() => {});
  }, [weeks]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group into weeks (Mon-Sun)
  const weekRows: DayStats[][] = [];
  let currentWeek: DayStats[] = [];
  for (const day of days) {
    const date = new Date(day.date + 'T00:00:00');
    const dow = date.getDay(); // 0=Sun
    const mondayIdx = dow === 0 ? 6 : dow - 1;

    if (currentWeek.length === 0 && mondayIdx > 0) {
      // Pad start of first week
      for (let i = 0; i < mondayIdx; i++) {
        currentWeek.push({ date: '', total: 0, done: 0, failed: 0, running: 0, jobs: [] });
      }
    }

    currentWeek.push(day);

    if (currentWeek.length === 7) {
      weekRows.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: '', total: 0, done: 0, failed: 0, running: 0, jobs: [] });
    }
    weekRows.push(currentWeek);
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalIcon size={24} /> Job Calendar
            </h1>
            <PageInfo title="Calendar" description="Visual calendar showing job execution history. See at a glance which days had the most activity and what succeeded or failed." features={["Colored dots show job outcomes — green for done, red for failed", "Navigate between weeks to see historical patterns", "Click a day to see all jobs that ran"]} />
          </div>
          <p className="page-sub" style={{ marginBottom: 0 }}>Visual job history by day. Click a day to see details.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn-sm"
            onClick={() => setWeeks(Math.max(1, weeks - 1))}
            disabled={weeks <= 1}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="muted" style={{ fontSize: 13, minWidth: 60, textAlign: 'center' }}>
            {weeks} weeks
          </span>
          <button
            className="btn-sm"
            onClick={() => setWeeks(Math.min(12, weeks + 1))}
            disabled={weeks >= 12}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {weekRows.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {week.map((day, di) => (
              <div
                key={`${wi}-${di}`}
                onClick={() => day.date && day.total > 0 && setSelectedDay(day)}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '8px 6px',
                  minHeight: 60,
                  cursor: day.total > 0 ? 'pointer' : 'default',
                  background: day.date === today
                    ? 'rgba(110, 168, 254, 0.06)'
                    : selectedDay?.date === day.date
                      ? 'rgba(110, 168, 254, 0.04)'
                      : 'transparent',
                  borderColor: day.date === today ? 'var(--accent)' : 'var(--line)',
                  transition: 'background 0.15s ease',
                  opacity: day.date ? 1 : 0.3,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                  {day.date ? parseInt(day.date.split('-')[2]) : ''}
                </div>
                {day.total > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {day.jobs.slice(0, 6).map(j => (
                      <div
                        key={j.id}
                        title={`${j.title} (${j.status})`}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: dotColor(j.status),
                        }}
                      />
                    ))}
                    {day.total > 6 && (
                      <span style={{ fontSize: 9, color: 'var(--muted)' }}>+{day.total - 6}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Day detail panel */}
      {selectedDay && selectedDay.total > 0 && (
        <div className="card card-animated" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>
              {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge good">{selectedDay.done} done</span>
              {selectedDay.failed > 0 && <span className="badge bad">{selectedDay.failed} failed</span>}
              {selectedDay.running > 0 && <span className="badge accent">{selectedDay.running} active</span>}
            </div>
          </div>
          {selectedDay.jobs.map(j => (
            <div key={j.id} className="feed-item" style={{ padding: '6px 0' }}>
              <div className="feed-dot" style={{ background: dotColor(j.status) }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{j.title}</span>
                <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>{j.engine}</span>
              </div>
              <span className={`badge ${j.status === 'done' ? 'good' : j.status === 'failed' ? 'bad' : 'accent'}`}>
                {j.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
