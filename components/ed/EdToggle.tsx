'use client';

import { MessageSquare } from 'lucide-react';

interface EdToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function EdToggle({ isOpen, onToggle }: EdToggleProps) {
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
