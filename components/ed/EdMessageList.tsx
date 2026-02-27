'use client';

import { useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions_taken?: ActionResult[];
  model_used?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

interface ActionResult {
  type: string;
  ok: boolean;
  id?: string;
  job_id?: string;
  task_id?: string;
  error?: string;
}

interface EdMessageListProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

function formatAction(action: ActionResult): string {
  const icon = action.ok ? '\u2705' : '\u274c';
  switch (action.type) {
    case 'create_research':
      return `${icon} Created research item`;
    case 'queue_scout':
      return `${icon} Dispatched Scout`;
    case 'queue_hawk':
      return `${icon} Dispatched Hawk`;
    case 'create_task':
      return `${icon} Created task`;
    case 'queue_draft':
      return `${icon} Queued draft generation`;
    case 'spawn_job':
      return `${icon} Spawned job`;
    case 'check_status':
      return `${icon} Status checked`;
    case 'challenge_board':
      return `${icon} Challenge board created`;
    case 'approve_task':
      return `${icon} Task approved`;
    case 'decide':
      return `${icon} Decision recorded`;
    case 'update_task':
      return `${icon} Task updated`;
    case 'request_tools':
      return `${icon} Tools assigned`;
    case 'code_change':
      return `${icon} Code change dispatched to Kerry (CTO)${action.job_id ? ` — job ${action.job_id.slice(0, 8)}` : ''}`;
    case 'deploy':
      return `${icon} Deployment triggered${action.job_id ? ` — job ${action.job_id.slice(0, 8)}` : ''}`;
    case 'acknowledge_notification':
      return `${icon} Notification acknowledged`;
    case 'create_notification':
      return `${icon} Reminder created`;
    default:
      return `${icon} ${action.type}`;
  }
}

interface ChallengeOption {
  label: string;
  summary: string;
  recommended_by?: string[];
  pros?: string[];
  cons?: string[];
}

/** Detect and parse challenge board data embedded in message content */
function extractChallengeBoard(text: string): { cleanText: string; board: { title: string; options: ChallengeOption[] } | null } {
  const boardRegex = /\[CHALLENGE_BOARD\](.*?)\[\/CHALLENGE_BOARD\]/s;
  const match = boardRegex.exec(text);
  if (!match) return { cleanText: text, board: null };

  try {
    const board = JSON.parse(match[1]);
    const cleanText = text.replace(boardRegex, '').trim();
    return { cleanText, board };
  } catch {
    return { cleanText: text, board: null };
  }
}

function ChallengeCard({ board }: { board: { title: string; options: ChallengeOption[] } }) {
  return (
    <div className="ed-challenge-board">
      <div className="ed-challenge-header">
        <span className="ed-challenge-icon">&#x2696;&#xFE0F;</span>
        <strong>{board.title}</strong>
      </div>
      <div className="ed-challenge-options">
        {board.options.map((opt, i) => (
          <div key={i} className={`ed-challenge-option ${i === 0 ? 'recommended' : ''}`}>
            <div className="ed-option-label">
              <span className="ed-option-letter">{opt.label}</span>
              {i === 0 && <span className="ed-option-badge">Recommended</span>}
            </div>
            <div className="ed-option-summary">{opt.summary}</div>
            {opt.recommended_by && opt.recommended_by.length > 0 && (
              <div className="ed-option-supporters">
                Backed by: {opt.recommended_by.join(', ')}
              </div>
            )}
            {opt.pros && opt.pros.length > 0 && (
              <div className="ed-option-pros">
                {opt.pros.map((p, j) => (
                  <div key={j} className="ed-pro">+ {p}</div>
                ))}
              </div>
            )}
            {opt.cons && opt.cons.length > 0 && (
              <div className="ed-option-cons">
                {opt.cons.map((c, j) => (
                  <div key={j} className="ed-con">- {c}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple markdown: bold, italic, code, links, lists */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br/>');
}

export default function EdMessageList({ messages, streamingContent, isStreaming }: EdMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="ed-messages">
      {messages.length === 0 && !isStreaming && (
        <div className="ed-empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1f44b;</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Hey David</div>
          <div className="muted">What are we working on?</div>
        </div>
      )}

      {messages.map((msg) => {
        const { cleanText, board } = msg.role === 'assistant'
          ? extractChallengeBoard(msg.content)
          : { cleanText: msg.content, board: null };

        return (
        <div key={msg.id} className={`ed-message ed-message-${msg.role}`}>
          <div className="ed-message-role">{msg.role === 'user' ? 'David' : 'Ed'}</div>
          <div
            className="ed-message-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanText) }}
          />
          {board && <ChallengeCard board={board} />}
          {msg.actions_taken && msg.actions_taken.length > 0 && (
            <div className="ed-actions">
              {msg.actions_taken.map((a, i) => (
                <span key={i} className={`ed-action-chip ${a.ok ? 'good' : 'bad'}`}>
                  {formatAction(a)}
                </span>
              ))}
            </div>
          )}
          {msg.model_used && msg.duration_ms && (
            <div className="ed-message-meta">
              {msg.model_used} &middot; {(msg.duration_ms / 1000).toFixed(1)}s
            </div>
          )}
        </div>
        );
      })}

      {isStreaming && streamingContent && (
        <div className="ed-message ed-message-assistant">
          <div className="ed-message-role">Ed</div>
          <div
            className="ed-message-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }}
          />
          <div className="ed-typing" />
        </div>
      )}

      {isStreaming && !streamingContent && (
        <div className="ed-message ed-message-assistant">
          <div className="ed-message-role">Ed</div>
          <div className="ed-message-content">
            <div className="ed-thinking">Thinking...</div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
