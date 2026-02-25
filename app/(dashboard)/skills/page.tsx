'use client';

import { useEffect, useState } from 'react';

type Skill = {
  id: string;
  key: string;
  category: string | null;
  provider: string | null;
  status: 'enabled' | 'disabled' | 'pilot';
  cost_profile: string | null;
  notes: string | null;
};

function badge(status: Skill['status']) {
  if (status === 'enabled') return 'badge good';
  if (status === 'pilot') return 'badge warn';
  return 'badge bad';
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch('/api/skills', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSkills(d.skills || []));
  }, []);

  return (
    <div>
      <h1 className="page-title">Skills Registry</h1>
      <p className="page-sub">Available execution capabilities and their operational posture.</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Skill</th><th>Category</th><th>Provider</th><th>Status</th><th>Cost Profile</th><th>Notes</th></tr></thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td>{s.key}</td>
                <td>{s.category || '—'}</td>
                <td>{s.provider || '—'}</td>
                <td><span className={badge(s.status)}>{s.status}</span></td>
                <td>{s.cost_profile || '—'}</td>
                <td>{s.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
