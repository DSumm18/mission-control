'use client';

import { useEffect, useState } from 'react';
import PageInfo from '@/components/ui/PageInfo';

/* ── types ───────────────────────────────────────────────── */

type Newsletter = {
  id: string;
  title: string;
  week_no: number | null;
  pipeline_status: string;
};

type Draft = {
  id: string;
  newsletter_id: string;
  version: number;
  full_markdown: string | null;
  voice_check_score: number | null;
  voice_check_notes: string | null;
  status: string;
  david_notes: string | null;
  created_at: string;
};

type Section = {
  id: string;
  draft_id: string;
  section_key: string;
  sort_order: number;
  title: string | null;
  body_markdown: string | null;
};

/* ── constants ───────────────────────────────────────────── */

const SECTION_LABELS: Record<string, string> = {
  headline: 'Headline',
  lead_story: 'Lead Story',
  data_snapshot: 'Data Snapshot',
  tool_spotlight: 'Tool Spotlight',
  policy_watch: 'Policy Watch',
  quick_wins: 'Quick Wins',
  week_ahead: 'Week Ahead',
  snippet_preview: 'Snippet Preview',
};

const SECTION_TARGETS: Record<string, [number, number]> = {
  headline: [5, 15],
  lead_story: [400, 600],
  data_snapshot: [80, 150],
  tool_spotlight: [100, 200],
  policy_watch: [150, 300],
  quick_wins: [100, 200],
  week_ahead: [80, 150],
  snippet_preview: [40, 80],
};

/* ── component ───────────────────────────────────────────── */

export default function ContentStudioPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [selectedNl, setSelectedNl] = useState<string>('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState<string>('lead_story');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);

  // Load newsletters in pipeline (not published)
  useEffect(() => {
    fetch('/api/newsletters?status=draft')
      .then(r => r.json())
      .then(d => {
        const items = (d.items || []).filter((n: Newsletter) => n.pipeline_status !== 'published');
        setNewsletters(items);
        if (items.length > 0 && !selectedNl) setSelectedNl(items[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load drafts when newsletter changes
  useEffect(() => {
    if (!selectedNl) return;
    fetch(`/api/newsletters/${selectedNl}/drafts`)
      .then(r => r.json())
      .then(d => {
        const draftList = d.drafts || [];
        setDrafts(draftList);
        if (draftList.length > 0) {
          setSelectedDraft(draftList[0]);
          setSections(d.sections || []);
        } else {
          setSelectedDraft(null);
          setSections([]);
        }
      });
  }, [selectedNl]);

  // Update editor when section changes
  useEffect(() => {
    const sec = sections.find(s => s.section_key === activeSection);
    setEditContent(sec?.body_markdown || selectedDraft?.full_markdown || '');
  }, [activeSection, sections, selectedDraft]);

  function wordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  async function handleGenerateDraft() {
    if (!selectedNl) return;
    setGenerating(true);
    try {
      await fetch(`/api/newsletters/${selectedNl}/generate-draft`, { method: 'POST' });
      // Reload drafts
      const r = await fetch(`/api/newsletters/${selectedNl}/drafts`);
      const d = await r.json();
      setDrafts(d.drafts || []);
      if (d.drafts?.length > 0) {
        setSelectedDraft(d.drafts[0]);
        setSections(d.sections || []);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleVoiceCheck() {
    if (!selectedNl || !selectedDraft) return;
    setChecking(true);
    try {
      await fetch(`/api/newsletters/${selectedNl}/auto-qa`, { method: 'POST' });
    } finally {
      setChecking(false);
    }
  }

  const currentSection = sections.find(s => s.section_key === activeSection);
  const target = SECTION_TARGETS[activeSection];
  const wc = wordCount(editContent);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="page-title">Content Studio</h1>
        <PageInfo
          title="Content Studio"
          description="Draft and edit newsletter sections. This is where research gets transformed into polished content for the Schoolgle Signal."
          features={["Create and edit newsletter sections", "AI-assisted drafting from research items", "Preview sections before assembly", "Track section status through the pipeline"]}
        />
      </div>
      <p className="page-sub">Edit and humanise newsletter drafts</p>

      <div className="grid">
        {/* ── Top bar ──────────────────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 12', display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedNl}
            onChange={e => setSelectedNl(e.target.value)}
            style={{ minWidth: 240 }}
          >
            <option value="">Select newsletter...</option>
            {newsletters.map(n => (
              <option key={n.id} value={n.id}>
                {n.title} ({n.pipeline_status})
              </option>
            ))}
          </select>

          {drafts.length > 0 && (
            <select
              value={selectedDraft?.id || ''}
              onChange={e => {
                const d = drafts.find(x => x.id === e.target.value);
                setSelectedDraft(d || null);
              }}
              style={{ minWidth: 140 }}
            >
              {drafts.map(d => (
                <option key={d.id} value={d.id}>v{d.version} — {d.status}</option>
              ))}
            </select>
          )}

          {selectedDraft?.voice_check_score && (
            <span className={`badge ${selectedDraft.voice_check_score >= 7 ? 'good' : selectedDraft.voice_check_score >= 5 ? 'warn' : 'bad'}`}>
              Voice: {selectedDraft.voice_check_score}/10
            </span>
          )}

          <div style={{ flex: 1 }} />

          <button className="btn-sm" onClick={handleVoiceCheck} disabled={checking || !selectedDraft}>
            {checking ? 'Checking...' : 'Check Voice'}
          </button>
          <button className="btn-sm btn-primary" onClick={handleGenerateDraft} disabled={generating || !selectedNl}>
            {generating ? 'Generating...' : 'Generate Draft'}
          </button>
        </div>

        {/* ── Left panel: Editor ───────────────────────────── */}
        <div className="card" style={{ gridColumn: 'span 8' }}>
          {/* Section tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {Object.entries(SECTION_LABELS).map(([key, label]) => {
              const sec = sections.find(s => s.section_key === key);
              const filled = !!(sec?.body_markdown);
              return (
                <button
                  key={key}
                  className="btn-sm"
                  onClick={() => setActiveSection(key)}
                  style={{
                    background: activeSection === key ? 'rgba(110, 168, 254, 0.12)' : filled ? 'rgba(61, 220, 151, 0.08)' : 'var(--panel-2)',
                    borderColor: activeSection === key ? 'var(--accent)' : filled ? 'rgba(61, 220, 151, 0.2)' : 'var(--line)',
                    color: activeSection === key ? 'var(--accent)' : filled ? 'var(--good)' : 'var(--muted)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder={`Write the ${SECTION_LABELS[activeSection] || 'section'} here...`}
              style={{ width: '100%', minHeight: 300, fontFamily: 'monospace', fontSize: 14 }}
            />
            <div style={{
              position: 'absolute', bottom: 8, right: 12,
              fontSize: 12, color: target && wc >= target[0] && wc <= target[1] ? 'var(--good)' : 'var(--muted)',
            }}>
              {wc} words {target ? `(target: ${target[0]}-${target[1]})` : ''}
            </div>
          </div>
        </div>

        {/* ── Right panel: Checklist + Info ─────────────────── */}
        <div style={{ gridColumn: 'span 4', display: 'grid', gap: 10, alignContent: 'start' }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--muted)' }}>
              SECTIONS CHECKLIST
            </div>
            {Object.entries(SECTION_LABELS).map(([key, label]) => {
              const sec = sections.find(s => s.section_key === key);
              const filled = !!(sec?.body_markdown);
              const secWc = sec?.body_markdown ? wordCount(sec.body_markdown) : 0;
              const t = SECTION_TARGETS[key];
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', borderBottom: '1px solid var(--line)',
                  fontSize: 13,
                }}>
                  <span style={{ color: filled ? 'var(--good)' : 'var(--muted)' }}>
                    {filled ? '✓' : '○'}
                  </span>
                  <span style={{ flex: 1 }}>{label}</span>
                  <span className="muted">
                    {filled ? `${secWc}w` : t ? `${t[0]}-${t[1]}w` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Voice check notes */}
          {selectedDraft?.voice_check_notes && (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
                VOICE CHECK NOTES
              </div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {selectedDraft.voice_check_notes}
              </div>
            </div>
          )}

          {!selectedDraft && selectedNl && (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <div className="muted" style={{ marginBottom: 8 }}>No drafts yet</div>
              <button className="btn-primary" onClick={handleGenerateDraft} disabled={generating}>
                {generating ? 'Generating...' : 'Generate First Draft'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
