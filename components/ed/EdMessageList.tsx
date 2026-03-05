"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions_taken?: ActionResult[];
  model_used?: string | null;
  duration_ms?: number | null;
  created_at: string;
  sender?: string; // 'david' | 'ed' | 'jarvis'
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
  streamingSender?: string;
  isLoading?: boolean;
}

function getSenderName(msg: Message): string {
  if (msg.sender === "jarvis") return "Jarvis";
  if (msg.sender === "ed") return "Ed";
  if (msg.sender === "david") return "David";
  return msg.role === "user" ? "David" : "Ed";
}

function getSenderClass(msg: Message): string {
  if (msg.sender === "jarvis") return "jarvis";
  if (msg.sender === "ed") return "ed";
  if (msg.sender === "david") return "david";
  return msg.role === "user" ? "david" : "ed";
}

function formatAction(action: ActionResult): string {
  const icon = action.ok ? "\u2705" : "\u274c";
  switch (action.type) {
    case "create_research":
      return `${icon} Created research item`;
    case "queue_scout":
      return `${icon} Dispatched Scout`;
    case "queue_hawk":
      return `${icon} Dispatched Hawk`;
    case "create_task":
      return `${icon} Created task`;
    case "queue_draft":
      return `${icon} Queued draft generation`;
    case "spawn_job":
      return `${icon} Spawned job`;
    case "check_status":
      return `${icon} Status checked`;
    case "challenge_board":
      return `${icon} Challenge board created`;
    case "approve_task":
      return `${icon} Task approved`;
    case "decide":
      return `${icon} Decision recorded`;
    case "update_task":
      return `${icon} Task updated`;
    case "request_tools":
      return `${icon} Tools assigned`;
    case "code_change":
      return `${icon} Code change dispatched to Kerry (CTO)${action.job_id ? ` — job ${action.job_id.slice(0, 8)}` : ""}`;
    case "deploy":
      return `${icon} Deployment triggered${action.job_id ? ` — job ${action.job_id.slice(0, 8)}` : ""}`;
    case "acknowledge_notification":
      return `${icon} Notification acknowledged`;
    case "create_notification":
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
function extractChallengeBoard(text: string): {
  cleanText: string;
  board: { title: string; options: ChallengeOption[] } | null;
} {
  const boardRegex = /\[CHALLENGE_BOARD\](.*?)\[\/CHALLENGE_BOARD\]/s;
  const match = boardRegex.exec(text);
  if (!match) return { cleanText: text, board: null };

  try {
    const board = JSON.parse(match[1]);
    const cleanText = text.replace(boardRegex, "").trim();
    return { cleanText, board };
  } catch {
    return { cleanText: text, board: null };
  }
}

function ChallengeCard({
  board,
}: {
  board: { title: string; options: ChallengeOption[] };
}) {
  return (
    <div className="ed-challenge-board">
      <div className="ed-challenge-header">
        <span className="ed-challenge-icon">&#x2696;&#xFE0F;</span>
        <strong>{board.title}</strong>
      </div>
      <div className="ed-challenge-options">
        {board.options.map((opt, i) => (
          <div
            key={i}
            className={`ed-challenge-option ${i === 0 ? "recommended" : ""}`}
          >
            <div className="ed-option-label">
              <span className="ed-option-letter">{opt.label}</span>
              {i === 0 && <span className="ed-option-badge">Recommended</span>}
            </div>
            <div className="ed-option-summary">{opt.summary}</div>
            {opt.recommended_by && opt.recommended_by.length > 0 && (
              <div className="ed-option-supporters">
                Backed by: {opt.recommended_by.join(", ")}
              </div>
            )}
            {opt.pros && opt.pros.length > 0 && (
              <div className="ed-option-pros">
                {opt.pros.map((p, j) => (
                  <div key={j} className="ed-pro">
                    + {p}
                  </div>
                ))}
              </div>
            )}
            {opt.cons && opt.cons.length > 0 && (
              <div className="ed-option-cons">
                {opt.cons.map((c, j) => (
                  <div key={j} className="ed-con">
                    - {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Media detection ── */

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)(\?[^)\s]*)?$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)(\?[^)\s]*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)(\?[^)\s]*)?$/i;

interface MediaEmbed {
  type: "audio" | "image" | "video";
  url: string;
  label?: string;
}

/** Extract bare URLs and markdown links that point to media files */
function extractMedia(text: string): MediaEmbed[] {
  const embeds: MediaEmbed[] = [];
  const seen = new Set<string>();

  // Markdown links: [label](url)
  const mdLinkRe = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLinkRe.exec(text)) !== null) {
    const url = m[2];
    if (seen.has(url)) continue;
    seen.add(url);
    if (AUDIO_EXT.test(url)) embeds.push({ type: "audio", url, label: m[1] });
    else if (IMAGE_EXT.test(url))
      embeds.push({ type: "image", url, label: m[1] });
    else if (VIDEO_EXT.test(url))
      embeds.push({ type: "video", url, label: m[1] });
  }

  // Bare URLs (not inside markdown links)
  const bareUrlRe = /(?<!\()(https?:\/\/[^\s)<>]+)/g;
  while ((m = bareUrlRe.exec(text)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    if (AUDIO_EXT.test(url)) embeds.push({ type: "audio", url });
    else if (IMAGE_EXT.test(url)) embeds.push({ type: "image", url });
    else if (VIDEO_EXT.test(url)) embeds.push({ type: "video", url });
  }

  return embeds;
}

/** Simple markdown: bold, italic, code, links, lists */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    )
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n/g, "<br/>");
}

/* ── Lightbox overlay ── */

function Lightbox({
  media,
  onClose,
}: {
  media: MediaEmbed;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="ed-lightbox-overlay" onClick={onClose}>
      <div className="ed-lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="ed-lightbox-close" onClick={onClose}>
          &times;
        </button>
        {media.type === "image" && (
          <img src={media.url} alt={media.label || "Image"} />
        )}
        {media.type === "video" && (
          <video
            src={media.url}
            controls
            autoPlay
            style={{ maxWidth: "100%", maxHeight: "80vh" }}
          />
        )}
        {media.type === "audio" && (
          <div className="ed-lightbox-audio">
            <div className="ed-lightbox-audio-label">
              {media.label || "Audio"}
            </div>
            <audio
              src={media.url}
              controls
              autoPlay
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Inline media embeds ── */

function MediaEmbeds({
  embeds,
  onOpen,
}: {
  embeds: MediaEmbed[];
  onOpen: (m: MediaEmbed) => void;
}) {
  if (embeds.length === 0) return null;
  return (
    <div className="ed-media-embeds">
      {embeds.map((embed, i) => {
        if (embed.type === "audio") {
          return (
            <div key={i} className="ed-media-audio">
              <audio src={embed.url} controls preload="metadata" />
              {embed.label && (
                <div className="ed-media-label">{embed.label}</div>
              )}
            </div>
          );
        }
        if (embed.type === "image") {
          return (
            <div
              key={i}
              className="ed-media-image"
              onClick={() => onOpen(embed)}
            >
              <img
                src={embed.url}
                alt={embed.label || "Image"}
                loading="lazy"
              />
            </div>
          );
        }
        if (embed.type === "video") {
          return (
            <div key={i} className="ed-media-video">
              <video
                src={embed.url}
                controls
                preload="metadata"
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(embed);
                }}
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function EdMessageList({
  messages,
  streamingContent,
  isStreaming,
  streamingSender,
  isLoading,
}: EdMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const [lightboxMedia, setLightboxMedia] = useState<MediaEmbed | null>(null);
  const openLightbox = useCallback((m: MediaEmbed) => setLightboxMedia(m), []);
  const closeLightbox = useCallback(() => setLightboxMedia(null), []);

  // Detect if user has scrolled up (away from bottom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledRef.current = distFromBottom > 80;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Only auto-scroll if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Reset scroll lock when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      userScrolledRef.current = false;
    }
  }, [isStreaming]);

  return (
    <div className="ed-messages" ref={containerRef}>
      {messages.length === 0 && !isStreaming && (
        <div className="ed-empty">
          {isLoading ? (
            <>
              <div className="ed-thinking">Loading messages...</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1f44b;</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Hey David</div>
              <div className="muted">What are we working on?</div>
            </>
          )}
        </div>
      )}

      {messages.map((msg) => {
        const { cleanText, board } =
          msg.role === "assistant"
            ? extractChallengeBoard(msg.content)
            : { cleanText: msg.content, board: null };

        const mediaEmbeds = extractMedia(cleanText);

        return (
          <div
            key={msg.id}
            className={`ed-message ed-message-${msg.role} ed-sender-${getSenderClass(msg)}`}
          >
            <div className={`ed-message-role ed-role-${getSenderClass(msg)}`}>
              {getSenderName(msg)}
            </div>
            <div
              className="ed-message-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanText) }}
            />
            <MediaEmbeds embeds={mediaEmbeds} onOpen={openLightbox} />
            {board && <ChallengeCard board={board} />}
            {msg.actions_taken && msg.actions_taken.length > 0 && (
              <div className="ed-actions">
                {msg.actions_taken.map((a, i) => (
                  <span
                    key={i}
                    className={`ed-action-chip ${a.ok ? "good" : "bad"}`}
                  >
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
        <div
          className={`ed-message ed-message-assistant ed-sender-${streamingSender || "ed"}`}
        >
          <div className={`ed-message-role ed-role-${streamingSender || "ed"}`}>
            {streamingSender === "jarvis" ? "Jarvis" : "Ed"}
          </div>
          <div
            className="ed-message-content"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(streamingContent),
            }}
          />
          <div className="ed-typing" />
        </div>
      )}

      {isStreaming && !streamingContent && (
        <div
          className={`ed-message ed-message-assistant ed-sender-${streamingSender || "ed"}`}
        >
          <div className={`ed-message-role ed-role-${streamingSender || "ed"}`}>
            {streamingSender === "jarvis" ? "Jarvis" : "Ed"}
          </div>
          <div className="ed-message-content">
            <div className="ed-thinking">Thinking...</div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {lightboxMedia && (
        <Lightbox media={lightboxMedia} onClose={closeLightbox} />
      )}
    </div>
  );
}
