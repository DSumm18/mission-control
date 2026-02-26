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
};

function badge(status: string) {
  if (status === 'enabled') return 'badge good';
  if (status === 'pilot') return 'badge warn';
  return 'badge bad';
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: '', category: '', provider: '', status: 'enabled',
    cost_profile: '', notes: '', usage_guidelines: '', mcp_server_name: '',
    requires_api_key: false,
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/skills', { cache: 'no-store' });
    const d = await res.json();
    setSkills(d.skills || []);
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 className="page-title">Skills Registry</h1>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); }}>
          {showForm ? 'Cancel' : '+ Add Skill'}
        </button>
      </div>
      <p className="page-sub">Available execution capabilities, MCP servers, and their configuration.</p>

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
              <th>Skill</th><th>Category</th><th>Provider</th><th>MCP Server</th><th>Status</th><th>Cost</th><th>API Key</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {skills.map(s => (
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
                  <td>
                    <label className="toggle" style={{ transform: 'scale(0.8)' }}>
                      <input type="checkbox" checked={form.requires_api_key} onChange={e => setForm(f => ({ ...f, requires_api_key: e.target.checked }))} />
                      <span className="toggle-slider" />
                    </label>
                  </td>
                  <td>
                    <button className="btn-sm btn-primary" onClick={onUpdate} disabled={saving}>Save</button>
                    <button className="btn-sm" onClick={() => setEditId(null)} style={{ marginLeft: 4 }}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td><strong>{s.key}</strong></td>
                  <td>{s.category || '—'}</td>
                  <td>{s.provider || '—'}</td>
                  <td style={{ fontSize: 12 }}>{s.mcp_server_name || '—'}</td>
                  <td><span className={badge(s.status)}>{s.status}</span></td>
                  <td>{s.cost_profile || '—'}</td>
                  <td>{s.requires_api_key ? <span className="badge warn">yes</span> : '—'}</td>
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
