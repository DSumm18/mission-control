'use client';

import { type LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
};

const trendConfig = {
  up: { arrow: '\u2191', color: 'var(--good)' },
  down: { arrow: '\u2193', color: 'var(--bad)' },
  flat: { arrow: '\u2192', color: 'var(--muted)' },
} as const;

export function StatCard({ icon: Icon, label, value, trend, trendValue }: Props) {
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: '20px 24px',
        boxShadow: '0 0 20px rgba(110,168,254,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1,
          }}
        >
          {value}
        </span>

        {trend && trendValue && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: trendConfig[trend].color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {trendConfig[trend].arrow} {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
