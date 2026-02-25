import Link from 'next/link';

const kpis = [
  { label: 'Jobs Throughput', value: 'Live', note: 'Runner + evidence flow active' },
  { label: 'Deploy Health', value: 'Green', note: 'Patched build on Vercel' },
  { label: 'Decision Queue', value: 'Ready', note: 'Approval inbox wired' },
  { label: 'Mode Routing', value: 'Multi', note: 'Shell / Claude / Gemini / OpenAI' },
];

export default function HomePage() {
  return (
    <div>
      <h1 className="page-title">Mission Control v1</h1>
      <p className="page-sub">Operational dashboard for projects, jobs, decisions, and execution evidence.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        {kpis.map((k) => (
          <article className="card" key={k.label} style={{ gridColumn: 'span 3' }}>
            <div className="muted">{k.label}</div>
            <div className="kpi">{k.value}</div>
            <div className="muted">{k.note}</div>
          </article>
        ))}
      </section>

      <section className="grid">
        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Core Views</h3>
          <p className="muted">Everything expected in Mission Control is grouped into six operational views.</p>
          <ul>
            <li><Link href="/projects">Projects</Link> — portfolio and priorities</li>
            <li><Link href="/jobs">Jobs</Link> — create/run pipelines with evidence</li>
            <li><Link href="/decisions">Decisions</Link> — approve/reject/change requests</li>
            <li><Link href="/activity">Activity</Link> — trace everything that happened</li>
            <li><Link href="/creative-studio">Creative Studio</Link> — campaign and content ops</li>
          </ul>
        </article>

        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>This morning focus</h3>
          <ul>
            <li>Deployment path stabilised on a single project</li>
            <li>Vercel cron removed (scheduler handled by OpenClaw on Mac)</li>
            <li>UI shell upgraded from plain MVP to control-panel layout</li>
          </ul>
          <p className="muted">Next: bind each view to live Supabase data for full operational state.</p>
        </article>
      </section>
    </div>
  );
}
