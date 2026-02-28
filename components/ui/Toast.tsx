'use client';

interface ToastItem {
  id: number;
  message: string;
  type: 'good' | 'warn' | 'bad' | 'info';
  exiting?: boolean;
}

const ICONS: Record<string, string> = {
  good: '\u2713',
  warn: '\u26A0',
  bad: '\u2717',
  info: '\u2139',
};

export default function Toast({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type} ${t.exiting ? 'toast-exit' : ''}`}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
