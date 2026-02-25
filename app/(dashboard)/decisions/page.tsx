const pending = [
  { id: 'DEC-001', title: 'Approve production run for overnight jobs', risk: 'Medium', requestedBy: 'System' },
  { id: 'DEC-002', title: 'Ship revised jobs UX to production', risk: 'Low', requestedBy: 'Ed' },
  { id: 'DEC-003', title: 'Escalate failed model output for manual override', risk: 'High', requestedBy: 'Runner' },
];

function riskClass(risk: string) {
  if (risk === 'High') return 'badge bad';
  if (risk === 'Medium') return 'badge warn';
  return 'badge good';
}

export default function DecisionsPage() {
  return (
    <div>
      <h1 className="page-title">Decisions Inbox</h1>
      <p className="page-sub">Human-in-the-loop approvals before high-impact actions execute.</p>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Decision</th>
              <th>Requested By</th>
              <th>Risk</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.title}</td>
                <td>{d.requestedBy}</td>
                <td><span className={riskClass(d.risk)}>{d.risk}</span></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button>Approve</button>
                  <button>Request changes</button>
                  <button>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
