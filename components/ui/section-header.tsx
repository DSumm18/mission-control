'use client';

import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';

type Props = {
  icon: LucideIcon;
  title: string;
  action?: { label: string; href: string };
};

export function SectionHeader({ icon: Icon, title, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
      }}
    >
      <Icon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text)',
        }}
      >
        {title}
      </span>

      {action && (
        <Link
          href={action.href}
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
