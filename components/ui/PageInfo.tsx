'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';

interface PageInfoProps {
  title: string;
  description: string;
  features?: string[];
}

export default function PageInfo({ title, description, features }: PageInfoProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="page-info-wrap">
      <button
        className={`page-info-toggle ${open ? 'page-info-toggle-active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Hide info' : 'Show info'}
        title="What is this page?"
      >
        {open ? <X size={14} /> : <Info size={14} />}
      </button>
      {open && (
        <div className="page-info-card">
          <div className="page-info-title">{title}</div>
          <p className="page-info-desc">{description}</p>
          {features && features.length > 0 && (
            <ul className="page-info-features">
              {features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
