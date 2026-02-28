'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

type SearchResult = {
  id: string;
  type: 'job' | 'project' | 'agent' | 'task' | 'research' | 'newsletter';
  title: string;
  detail: string;
  href: string;
};

const TYPE_LABELS: Record<string, string> = {
  job: 'Job',
  project: 'Project',
  agent: 'Agent',
  task: 'Task',
  research: 'Research',
  newsletter: 'Newsletter',
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cmd+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=12`)
        .then(r => r.json())
        .then(d => {
          setResults(d.results || []);
          setActiveIdx(0);
        })
        .catch(() => {});
    }, 200);
  }, []);

  function navigate(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      navigate(results[activeIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="search-overlay" onClick={() => setOpen(false)}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap">
          <Search size={18} color="var(--muted)" />
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder="Search jobs, projects, agents, tasks..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            onKeyDown={onKeyDown}
          />
          <span className="cmd-k-hint">ESC</span>
        </div>
        <div className="search-results">
          {results.length === 0 && query.length >= 2 && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }} className="muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.type}-${r.id}`}
              className={`search-result ${i === activeIdx ? 'active' : ''}`}
              onClick={() => navigate(r)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="search-result-type">{TYPE_LABELS[r.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
