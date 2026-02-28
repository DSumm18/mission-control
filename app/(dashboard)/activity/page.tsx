'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Filter } from 'lucide-react';

type ActivityItem = {
  id: string;
  type: 'job' | 'notification' | 'challenge' | 'research' | 'newsletter';
  title: string;
  detail: string;
  status: string;
  statusColor: 'good' | 'warn' | 'bad' | 'accent' | 'muted';
  agent?: string;
  agentEmoji?: string;
  projectId?: string;
  projectName?: string;
  timestamp: string;
  link?: string;
};

const TYPE_EMOJIS: Record<string, string> = {
  job: '\u2699\uFE0F',
  notification: '\uD83D\uDD14',
  challenge: '\u2696\uFE0F',
  research: '\uD83D\uDD0D',
  newsletter: '\uD83D\uDCE8',
};

const TYPE_LABELS: Record<string, string> = {
  job: 'Job',
  notification: 'Notification',
  challenge: 'Challenge Board',
  research: 'Research',
  newsletter: 'Newsletter',
};

const POLL_MS = 30_000;

function groupByDate(items: ActivityItem[]): Map<string, ActivityItem[]> {
  const groups = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const date = new Date(item.timestamp).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(item);
  }
  return groups;
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [prevIds, setPrevIds] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(() => {
    const url = filter ? `/api/activity?limit=50&type=${filter}` : '/api/activity?limit=50';
    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const newItems: ActivityItem[] = d.items || [];
        setPrevIds(prev => {
          const currentIds = new Set(newItems.map(i => i.id));
          return currentIds.size > 0 ? currentIds : prev;
        });
        setItems(newItems);
      })
      .catch(() => {});
  }, [filter]);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const grouped = groupByDate(items);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={24} /> Activity Log
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>Live feed across jobs, research, newsletters, decisions, and notifications.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="var(--muted)" />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px' }}
          >
            <option value="">All Types</option>
            <option value="job">Jobs</option>
            <option value="notification">Notifications</option>
            <option value="challenge">Challenge Boards</option>
            <option value="research">Research</option>
            <option value="newsletter">Newsletters</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted">No activity to show.</div>
        </div>
      ) : (
        [...grouped.entries()].map(([date, dateItems]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, paddingLeft: 4 }}>
              {date}
            </div>
            <div className="card" style={{ padding: 0 }}>
              {dateItems.map((item) => {
                const isNew = prevIds.size > 0 && !prevIds.has(item.id);
                const content = (
                  <div
                    key={item.id}
                    className="feed-item"
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--line)',
                      background: isNew ? 'rgba(110, 168, 254, 0.04)' : undefined,
                      transition: 'background 0.3s ease',
                    }}
                  >
                    <div
                      className="feed-dot"
                      style={{
                        background: `var(--${item.statusColor === 'accent' ? 'accent' : item.statusColor === 'muted' ? 'muted' : item.statusColor})`,
                      }}
                    />
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {item.agentEmoji || TYPE_EMOJIS[item.type] || ''}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {item.title}
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        <span className={`badge ${item.statusColor}`}>{item.status}</span>
                        <span style={{ marginLeft: 6 }}>{item.detail}</span>
                        {item.agent && (
                          <span style={{ marginLeft: 6, color: 'var(--accent)' }}>{item.agent}</span>
                        )}
                        {item.projectName && (
                          <span style={{ marginLeft: 6 }}>{item.projectName}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {new Date(item.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {TYPE_LABELS[item.type]}
                      </span>
                    </div>
                  </div>
                );

                return item.link ? (
                  <Link key={item.id} href={item.link} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
