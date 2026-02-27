'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  category: string;
  priority: string;
  created_at: string;
}

interface EdNotificationsProps {
  onNotificationCount?: (count: number) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  job_complete: '\u2705',
  job_failed: '\u274c',
  decision_needed: '\ud83e\udd14',
  approval_needed: '\u270b',
  deploy_ready: '\ud83d\ude80',
  alert: '\u26a0\ufe0f',
  info: '\u2139\ufe0f',
  reminder: '\ud83d\udd14',
};

export default function EdNotifications({ onNotificationCount }: EdNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/ed/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data);
          onNotificationCount?.(data.length);
        }
      }
    } catch {
      // Non-critical
    }
  }, [onNotificationCount]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleAction = async (id: string, action: 'acknowledge' | 'dismiss') => {
    await fetch('/api/ed/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    onNotificationCount?.(notifications.length - 1);
  };

  if (notifications.length === 0) return null;

  return (
    <div className="ed-notifications">
      <button
        className="ed-notif-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <Bell size={14} />
        <span className="ed-notif-count">{notifications.length}</span>
        <span className="ed-notif-label">
          {notifications.length === 1 ? '1 notification' : `${notifications.length} notifications`}
        </span>
      </button>

      {expanded && (
        <div className="ed-notif-list">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`ed-notif-item ed-notif-${n.priority}`}
            >
              <div className="ed-notif-icon">
                {CATEGORY_ICONS[n.category] || '\ud83d\udccc'}
              </div>
              <div className="ed-notif-content">
                <div className="ed-notif-title">{n.title}</div>
                {n.body && (
                  <div className="ed-notif-body">{n.body.slice(0, 150)}</div>
                )}
              </div>
              <div className="ed-notif-actions">
                <button
                  className="ed-notif-btn"
                  onClick={() => handleAction(n.id, 'acknowledge')}
                  title="Acknowledge"
                >
                  <Check size={12} />
                </button>
                <button
                  className="ed-notif-btn"
                  onClick={() => handleAction(n.id, 'dismiss')}
                  title="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
