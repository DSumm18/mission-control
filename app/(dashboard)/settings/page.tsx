'use client';

import { useEffect, useState } from 'react';
import PageInfo from '@/components/ui/PageInfo';

type EnvKey = { name: string; set: boolean };
type Setting = { key: string; value: string };

export default function SettingsPage() {
  const [envKeys, setEnvKeys] = useState<EnvKey[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/env-status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setEnvKeys(d.keys || []))
      .catch(() => {});
    loadSettings();
  }, []);

  async function loadSettings() {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    const d = await res.json();
    setSettings(d.settings || []);
  }

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      await loadSettings();
    } finally { setSaving(false); }
  }

  async function addSetting() {
    if (!editKey.trim()) return;
    await saveSetting(editKey.trim(), editValue);
    setEditKey('');
    setEditValue('');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Settings</h1>
        <PageInfo title="Settings" description="Global Mission Control configuration. Feature flags, scheduling intervals, parallel job limits, and system preferences." features={["Toggle feature flags on/off instantly", "Adjust scheduler polling interval", "Set parallel job execution limits", "Changes take effect on next scheduler cycle"]} />
      </div>
      <p className="page-sub">System configuration, environment status, and operational controls.</p>

      <section className="grid" style={{ marginBottom: 14 }}>
        {/* Environment Keys */}
        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>Environment Keys</h3>
          <p className="muted" style={{ marginBottom: 12 }}>Shows which API keys and secrets are configured on the execution node. Values are never exposed.</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {envKeys.map(k => (
              <div key={k.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <code style={{ fontSize: 13 }}>{k.name}</code>
                <span className={`badge ${k.set ? 'good' : 'bad'}`}>
                  {k.set ? 'configured' : 'missing'}
                </span>
              </div>
            ))}
            {envKeys.length === 0 && <div className="muted">Loading...</div>}
          </div>
        </article>

        {/* MC Settings */}
        <article className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ marginTop: 0 }}>MC Settings</h3>
          <p className="muted" style={{ marginBottom: 12 }}>Operational parameters stored in Supabase. Changes take effect immediately.</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {settings.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <code style={{ fontSize: 13, minWidth: 160 }}>{s.key}</code>
                <input
                  defaultValue={s.value}
                  onBlur={e => {
                    if (e.target.value !== s.value) saveSetting(s.key, e.target.value);
                  }}
                  style={{ flex: 1, padding: '4px 8px', fontSize: 13 }}
                />
              </div>
            ))}
            {settings.length === 0 && <div className="muted">No settings configured</div>}
          </div>

          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Add Setting</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Key" value={editKey} onChange={e => setEditKey(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} />
              <input placeholder="Value" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} />
              <button onClick={addSetting} disabled={saving} className="btn-primary btn-sm">Add</button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
