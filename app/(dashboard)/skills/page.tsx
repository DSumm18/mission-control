'use client';

import { FormEvent, useEffect, useState } from 'react';

type Skill = {
  id: string;
  key: string;
  category: string | null;
  provider: string | null;
  status: 'enabled' | 'disabled' | 'pilot';
  cost_profile: string | null;
  notes: string | null;
  usage_guidelines: string | null;
  mcp_server_name: string | null;
  requires_api_key: boolean;
  monthly_cost?: number | null;
  value_notes?: string | null;
};

type AgentSkill = {
  agent_id: string;
  agent_name: string;
  avatar_emoji: string | null;
};

type SkillWithAgents = Skill & {
  assigned_agents: AgentSkill[];
  job_count: number;
  success_rate: number;
};

function badge(status: string) {
  if (status === 'enabled') return 'badge good';
  if (status === 'pilot') return 'badge warn';
  return 'badge bad';
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillWithAgents[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'pilot' | 'disabled' | 'unassigned'>('all');
  const [form, setForm] = useState({
    key: '', category: '', provider: '', status: 'enabled',
    cost_profile: '', notes: '', usage_guidelines: '', mcp_server_name: '',
    requires_api_key: false,
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    // Fetch skills
    const skillsRes = await fetch('/api/skills', { cache: 'no-store' });
    const skillsData = await skillsRes.json();
    const rawSkills: Skill[] = skillsData.skills || [];

    // Fetch all agents with their skills
    const agentsRes = await fetch('/api/agents', { cache: 'no-store' });
    const agentsData = await agentsRes.json();
    const agents = (agentsData.agents || agentsData || []) as { id: string; name: string; avatar_emoji: string | null }[];

    // Fetch all skill assignments
    const assignmentPromises = agents.map(async (agent) => {
      const res = await fetch(`/api/agents/${agent.id}/skills`, { cache: 'no-store' });
      const data = await res.json();
      const assigned = (data.skills || []).filter((s: { assigned: boolean }) => s.assigned);
      return { agent, assigned: assigned.map((s: { id: string }) => s.id) };
    });

    const assignments = await Promise.all(assignmentPromises);

    // Build skill → agents map
    const skillAgentsMap = new Map<string, AgentSkill[]>();
    for (const { agent, assigned } of assignments) {
      for (const skillId of assigned) {
        const list = skillAgentsMap.get(skillId) || [];
        list.push({ agent_id: agent.id, agent_name: agent.name, avatar_emoji: agent.avatar_emoji });
        skillAgentsMap.set(skillId, list);
      }
    }

    const enriched: SkillWithAgents[] = rawSkills.map(s => ({
      ...s,
      assigned_agents: skillAgentsMap.get(s.id) || [],
      job_count: 0, // TODO: populate from job stats when available
      success_rate: 0,
    }));

    setSkills(enriched);
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key,
          category: form.category || undefined,
          provider: form.provider || undefined,
          status: form.status,
          cost_profile: form.cost_profile || undefined,
          notes: form.notes || undefined,
          usage_guidelines: form.usage_guidelines || undefined,
          mcp_server_name: form.mcp_server_name || undefined,
          requires_api_key: form.requires_api_key,
        }),
      });
      setForm({ key: '', category: '', provider: '', status: 'enabled', cost_profile: '', notes: '', usage_guidelines: '', mcp_server_name: '', requires_api_key: false });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  }

  async function onUpdate() {
    if (!editId) return;
    setSaving(true);
    try {
      await fetch(`/api/skills/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category || null,
          provider: form.provider || null,
          status: form.status,
          cost_profile: form.cost_profile || null,
          notes: form.notes || null,
          usage_guidelines: form.usage_guidelines || null,
          mcp_server_name: form.mcp_server_name || null,
          requires_api_key: form.requires_api_key,
        }),
      });
      setEditId(null);
      await load();
    } finally { setSaving(false); }
  }

  function startEdit(s: Skill) {
    setEditId(s.id);
    setForm({
      key: s.key,
      category: s.category || '',
      provider: s.provider || '',
      status: s.status,
      cost_profile: s.cost_profile || '',
      notes: s.notes || '',
      usage_guidelines: s.usage_guidelines || '',
      mcp_server_name: s.mcp_server_name || '',
      requires_api_key: s.requires_api_key || false,
    });
  }

  const filtered = skills.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'unassigned') return s.assigned_agents.length === 0;
    return s.status === filter;
  });

  const totalSkills = skills.length;
  const enabledSkills = skills.filter(s => s.status === 'enabled').length;
  const unassigned = skills.filter(s => s.assigned_agents.length === 0).length;
  const categories = [...new Set(skills.map(s => s.category).filter(Boolean))];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 className="page-title">Skills Registry</h1>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); }}>
          {showForm ? 'Cancel' : '+ Add Skill'}
        </button>
      </div>
      <p className="page-sub">
        {totalSkills} skills ({enabledSkills} enabled) across {categories.length} categories
        {unassigned > 0 && <span style={{ color: 'var(--bad)' }}> &middot; {unassigned} unassigned</span>}
      </p>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {categories.sort().map(cat => {
          const catSkills = skills.filter(s => s.category === cat);
          const assigned = catSkills.filter(s => s.assigned_agents.length > 0).length;
          return (
            <div key={cat} className="card" style={{ padding: '10px 12px' }}>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>{cat}</div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{catSkills.length}</div>
              <div className="muted" style={{ fontSize: 11 }}>{assigned} assigned</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['all', 'enabled', 'pilot', 'disabled', 'unassigned'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '3px 12px', border: '1px solid var(--line)', borderRadius: 6,
              background: filter === f ? 'var(--accent)' : 'transparent',
              color: filter === f ? 'var(--bg)' : 'var(--fg)',
              cursor: 'pointer', fontSize: 11, fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f} ({f === 'all' ? skills.length : f === 'unassigned' ? unassigned : skills.filter(s => s.status === f).length})
          </button>
        ))}
      </div>

      {/* Add Skill Form */}
      {showForm && !editId && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>New Skill</h3>
          <form onSubmit={onCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <input placeholder="Key (unique)" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} required />
            <input placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            <input placeholder="Provider" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
            <input placeholder="MCP Server Name" value={form.mcp_server_name} onChange={e => setForm(f => ({ ...f, mcp_server_name: e.target.value }))} />
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="enabled">Enabled</option>
              <option value="pilot">Pilot</option>
              <option value="disabled">Disabled</option>
            </select>
            <input placeholder="Cost Profile" value={form.cost_profile} onChange={e => setForm(f => ({ ...f, cost_profile: e.target.value }))} />
            <textarea placeholder="Usage Guidelines" value={form.usage_guidelines} onChange={e => setForm(f => ({ ...f, usage_guidelines: e.target.value }))} rows={3} style={{ gridColumn: 'span 3' }} />
            <input placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ gridColumn: 'span 2' }} />
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Skill'}</button>
          </form>
        </div>
      )}

      {/* Skills Table */}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Skill</th><th>Category</th><th>Provider</th><th>MCP Server</th><th>Status</th><th>Cost</th><th>Assigned To</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              editId === s.id ? (
                <tr key={s.id} style={{ background: 'rgba(110,168,254,0.05)' }}>
                  <td><strong>{s.key}</strong></td>
                  <td><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ width: 80, padding: '4px 6px', fontSize: 12 }} /></td>
                  <td><input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} style={{ width: 80, padding: '4px 6px', fontSize: 12 }} /></td>
                  <td><input value={form.mcp_server_name} onChange={e => setForm(f => ({ ...f, mcp_server_name: e.target.value }))} style={{ width: 120, padding: '4px 6px', fontSize: 12 }} /></td>
                  <td>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ padding: '4px 6px', fontSize: 12 }}>
                      <option value="enabled">enabled</option>
                      <option value="pilot">pilot</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </td>
                  <td><input value={form.cost_profile} onChange={e => setForm(f => ({ ...f, cost_profile: e.target.value }))} style={{ width: 60, padding: '4px 6px', fontSize: 12 }} /></td>
                  <td></td>
                  <td>
                    <button className="btn-sm btn-primary" onClick={onUpdate} disabled={saving}>Save</button>
                    <button className="btn-sm" onClick={() => setEditId(null)} style={{ marginLeft: 4 }}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td>
                    <strong>{s.key}</strong>
                    {s.notes && <div className="muted" style={{ fontSize: 11 }}>{s.notes}</div>}
                  </td>
                  <td>{s.category || '\u2014'}</td>
                  <td>{s.provider || '\u2014'}</td>
                  <td style={{ fontSize: 12 }}>{s.mcp_server_name || <span className="muted">built-in</span>}</td>
                  <td><span className={badge(s.status)}>{s.status}</span></td>
                  <td>{s.cost_profile || '\u2014'}</td>
                  <td>
                    {s.assigned_agents.length > 0 ? (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {s.assigned_agents.map(a => (
                          <span key={a.agent_id} className="badge" style={{ fontSize: 10 }} title={a.agent_name}>
                            {a.avatar_emoji || '\u{1F916}'} {a.agent_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted" style={{ fontSize: 11 }}>none</span>
                    )}
                  </td>
                  <td><button className="btn-sm" onClick={() => startEdit(s)}>Edit</button></td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
