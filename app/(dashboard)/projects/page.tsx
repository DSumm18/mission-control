const projects = [
  { name: 'Mission Control', status: 'Live', lane: 'Execution', owner: 'Ed', priority: 'P1' },
  { name: 'ClawPhone', status: 'Shipping', lane: 'Mobile', owner: 'David', priority: 'P1' },
  { name: 'MyMeme', status: 'Growth', lane: 'Revenue', owner: 'Ed', priority: 'P2' },
  { name: 'Schoolgle', status: 'Core', lane: 'Business', owner: 'David', priority: 'P1' },
];

export default function ProjectsPage() {
  return (
    <div>
      <h1 className="page-title">Projects</h1>
      <p className="page-sub">Portfolio view for what is live, what is blocked, and what gets resources next.</p>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Lane</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.lane}</td>
                <td>{p.owner}</td>
                <td><span className="badge good">{p.status}</span></td>
                <td>{p.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
