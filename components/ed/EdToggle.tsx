'use client';

import { MessageSquare } from 'lucide-react';

interface EdToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  mobile?: boolean;
}

export default function EdToggle({ isOpen, onToggle, mobile }: EdToggleProps) {
  if (mobile) {
    return (
      <button
        onClick={onToggle}
        className={`mobile-ed-btn ${isOpen ? 'ed-toggle-active' : ''}`}
        title={isOpen ? 'Close Ed' : 'Talk to Ed'}
        aria-label="Talk to Ed"
      >
        <MessageSquare size={20} />
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      className={`ed-toggle ${isOpen ? 'ed-toggle-active' : ''}`}
      title={isOpen ? 'Close Ed' : 'Talk to Ed'}
    >
      <MessageSquare className="nav-icon" />
      Ed
    </button>
  );
}
