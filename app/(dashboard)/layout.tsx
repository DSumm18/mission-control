import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Mission Control</div>
        <div className="sub">Operator Console • Anti-Gravity</div>
        <nav className="nav">
          <Link href="/">Overview</Link>
          <Link href="/org-chart">Org Chart</Link>
          <Link href="/pipeline">Pipeline</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/jobs">Jobs Runner</Link>
          <Link href="/skills">Skills</Link>
          <Link href="/runs">Runs</Link>
          <Link href="/sources">Sources</Link>
          <Link href="/newsletters">Newsletters QA</Link>
          <Link href="/decisions">Decisions</Link>
          <Link href="/activity">Activity</Link>
          <Link href="/creative-studio">Creative Studio</Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
