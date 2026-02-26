'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, GitBranch, Kanban, FolderOpen, Bot, Zap,
  Wrench, Activity, Newspaper, Scale, Radio, Palette,
  ListTodo, Settings, CheckSquare,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/org-chart', label: 'Org Chart', icon: GitBranch },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/tasks', label: 'My Tasks', icon: CheckSquare },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/jobs', label: 'Jobs Runner', icon: Zap },
  { href: '/skills', label: 'Skills', icon: Wrench },
  { divider: true },
  { href: '/runs', label: 'Runs', icon: Activity },
  { href: '/sources', label: 'Sources', icon: Radio },
  { href: '/newsletters', label: 'Newsletters QA', icon: Newspaper },
  { href: '/decisions', label: 'Decisions', icon: Scale },
  { href: '/activity', label: 'Activity', icon: ListTodo },
  { href: '/creative-studio', label: 'Creative Studio', icon: Palette },
  { divider: true },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Mission Control</div>
        <div className="sub">Operator Console</div>
        <nav className="nav">
          {NAV.map((item, i) => {
            if ('divider' in item) {
              return <div key={`d-${i}`} className="nav-divider" />;
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
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
