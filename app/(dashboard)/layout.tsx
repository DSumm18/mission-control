'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, GitBranch, Kanban, FolderOpen, Bot, Zap,
  Wrench, Activity, Scale, Radio,
  ListTodo, Settings, CheckSquare,
  Calendar, Search, FileEdit, ShieldCheck, Send,
} from 'lucide-react';
import EdToggle from '@/components/ed/EdToggle';
import EdPanel from '@/components/ed/EdPanel';

type NavItem =
  | { href: string; label: string; icon: typeof LayoutDashboard }
  | { divider: true }
  | { section: string };

const NAV: NavItem[] = [
  // General
  { section: 'General' },
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/org-chart', label: 'Org Chart', icon: GitBranch },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/tasks', label: 'My Tasks', icon: CheckSquare },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/jobs', label: 'Jobs Runner', icon: Zap },
  { href: '/skills', label: 'Skills', icon: Wrench },

  // Schoolgle Signal
  { section: 'Schoolgle Signal' },
  { href: '/this-week', label: 'This Week', icon: Calendar },
  { href: '/research', label: 'Research', icon: Search },
  { href: '/content-studio', label: 'Content Studio', icon: FileEdit },
  { href: '/newsletters', label: 'QA Gate', icon: ShieldCheck },
  { href: '/publish', label: 'Publish', icon: Send },

  // Operations
  { section: 'Operations' },
  { href: '/sources', label: 'Sources', icon: Radio },
  { href: '/runs', label: 'Runs', icon: Activity },
  { href: '/decisions', label: 'Decisions', icon: Scale },
  { href: '/activity', label: 'Activity', icon: ListTodo },
  { divider: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [edOpen, setEdOpen] = useState(false);

  return (
    <div className={`shell ${edOpen ? 'shell-ed-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">Mission Control</div>
        <div className="sub">Operator Console</div>
        <nav className="nav">
          {NAV.map((item, i) => {
            if ('divider' in item) {
              return <div key={`d-${i}`} className="nav-divider" />;
            }
            if ('section' in item) {
              return (
                <div key={item.section} style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#667aa3',
                  padding: '12px 12px 4px',
                  marginTop: i === 0 ? 0 : 4,
                }}>
                  {item.section}
                </div>
              );
            }
            const Icon = item.icon;
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? 'active' : undefined}
              >
                <Icon className="nav-icon" />
                {item.label}
              </Link>
            );
          })}

          <div className="nav-divider" />
          <EdToggle isOpen={edOpen} onToggle={() => setEdOpen(!edOpen)} />
        </nav>
      </aside>
      <main className="main">{children}</main>
      {edOpen && <EdPanel onClose={() => setEdOpen(false)} />}
    </div>
  );
}
