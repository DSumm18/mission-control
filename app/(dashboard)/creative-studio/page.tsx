'use client';

import PageInfo from '@/components/ui/PageInfo';

const queue = [
  { item: 'Feature launch post: Mission Control', channel: 'X + LinkedIn', status: 'Drafting' },
  { item: 'ClawPhone voice update teaser', channel: 'Telegram', status: 'Queued' },
  { item: 'Schoolgle product narrative', channel: 'Website', status: 'Review' },
];

export default function CreativeStudioPage() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Creative Studio</h1>
        <PageInfo
          title="Creative Studio"
          description="Creative asset workspace for generating images, designs, and visual content for projects and newsletters."
          features={["Generate visual assets with AI", "Manage creative briefs", "Assets integrate with newsletter pipeline"]}
        />
      </div>
      <p className="page-sub">Campaign and content ops tied directly to product execution.</p>

      <section className="grid">
        <article className="card" style={{ gridColumn: 'span 7' }}>
          <h3 style={{ marginTop: 0 }}>Content Queue</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Item</th><th>Channel</th><th>Status</th></tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.item}>
                    <td>{q.item}</td>
                    <td>{q.channel}</td>
                    <td><span className="badge warn">{q.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card" style={{ gridColumn: 'span 5' }}>
          <h3 style={{ marginTop: 0 }}>Prompt Playbook</h3>
          <ul>
            <li>Launch announcement template</li>
            <li>Feature explainer with before/after</li>
            <li>Founder voice update (concise + direct)</li>
          </ul>
          <p className="muted">Next step: wire direct run-to-channel publishing actions.</p>
        </article>
      </section>
    </div>
  );
}
