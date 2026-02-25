const items = [
  { at: '08:17', event: 'Deployment succeeded', detail: 'mission-control-sepia-rho.vercel.app', type: 'good' },
  { at: '08:14', event: 'Security patch applied', detail: 'Next.js upgraded to 16.1.6', type: 'good' },
  { at: '08:03', event: 'Cron policy adjusted', detail: 'Vercel cron removed; OpenClaw scheduler retained', type: 'warn' },
  { at: '07:54', event: 'Repo synced', detail: 'main -> origin/main clean', type: 'good' },
];

export default function ActivityPage() {
  return (
    <div>
      <h1 className="page-title">Activity Log</h1>
      <p className="page-sub">Task → LLM → QA → Decision → Execution audit trail.</p>

      <div className="grid">
        {items.map((i) => (
          <article className="card" key={`${i.at}-${i.event}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{i.event}</strong>
              <span className={`badge ${i.type === 'warn' ? 'warn' : 'good'}`}>{i.at}</span>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>{i.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
