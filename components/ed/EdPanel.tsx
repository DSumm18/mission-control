'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Volume2, VolumeX } from 'lucide-react';
import EdMessageList from './EdMessageList';
import EdInput from './EdInput';
import VoiceInput from './VoiceInput';
import VoiceOutput from './VoiceOutput';
import type { ImagePreview } from './ImageUpload';

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

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface EdPanelProps {
  onClose: () => void;
}

export default function EdPanel({ onClose }: EdPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [lastAssistantText, setLastAssistantText] = useState('');

  // Load conversations
  useEffect(() => {
    fetch('/api/ed/conversations')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConversations(data);
          if (data.length > 0 && !activeConv) {
            setActiveConv(data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConv) return;

    // We don't have a messages-list endpoint yet — messages come from chat responses.
    // For now, clear messages when switching conversations.
    setMessages([]);
    setStreamingContent('');
  }, [activeConv]);

  const createConversation = async () => {
    const res = await fetch('/api/ed/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New conversation' }),
    });
    const conv = await res.json();
    if (conv.id) {
      setConversations((prev) => [conv, ...prev]);
      setActiveConv(conv.id);
      setMessages([]);
    }
  };

  const handleSend = useCallback(
    async (text: string, images?: ImagePreview[]) => {
      if (!activeConv) {
        // Auto-create conversation
        const res = await fetch('/api/ed/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 50) }),
        });
        const conv = await res.json();
        if (!conv.id) return;
        setConversations((prev) => [conv, ...prev]);
        setActiveConv(conv.id);
        // Continue with new conversation ID
        sendMessage(conv.id, text, images);
      } else {
        sendMessage(activeConv, text, images);
      }
    },
    [activeConv], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const sendMessage = async (convId: string, text: string, images?: ImagePreview[]) => {
    // Add user message to local state
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const res = await fetch('/api/ed/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: convId,
          message: text,
          images: images?.map((img) => ({
            base64: img.base64,
            mimeType: img.mimeType,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      const actions: ActionResult[] = [];
      let messageId = '';
      let durationMs = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            switch (data.type) {
              case 'text':
                // Handle action-stripped replacement
                if (data.content.startsWith('\n<!-- REPLACE -->\n')) {
                  fullText = data.content.replace('\n<!-- REPLACE -->\n', '');
                } else {
                  fullText += data.content;
                }
                setStreamingContent(fullText);
                break;
              case 'action':
                actions.push(data.action);
                break;
              case 'done':
                messageId = data.message_id;
                durationMs = data.duration_ms;
                break;
              case 'error':
                fullText += `\n\n**Error:** ${data.error}`;
                setStreamingContent(fullText);
                break;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Replace streaming content with final message
      const assistantMsg: Message = {
        id: messageId || `msg-${Date.now()}`,
        role: 'assistant',
        content: fullText,
        actions_taken: actions,
        model_used: actions.length > 0 ? 'claude-cli' : null,
        duration_ms: durationMs || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLastAssistantText(fullText);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Something went wrong: ${errorMsg}. Try again.`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  return (
    <aside className="ed-panel">
      <div className="ed-header">
        <div className="ed-header-left">
          <span className="ed-name">Ed</span>
          <span className="ed-status">CEO</span>
        </div>
        <div className="ed-header-actions">
          <button
            className="ed-icon-btn"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? 'Mute Ed' : 'Enable voice'}
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button className="ed-icon-btn" onClick={createConversation} title="New conversation">
            <Plus size={14} />
          </button>
          <button className="ed-icon-btn" onClick={onClose} title="Close Ed">
            <X size={14} />
          </button>
        </div>
      </div>

      {conversations.length > 1 && (
        <div className="ed-conv-bar">
          {conversations.slice(0, 5).map((c) => (
            <button
              key={c.id}
              className={`ed-conv-tab ${c.id === activeConv ? 'active' : ''}`}
              onClick={() => setActiveConv(c.id)}
            >
              {c.title.slice(0, 20)}
            </button>
          ))}
        </div>
      )}

      <EdMessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
      />

      <EdInput
        onSend={handleSend}
        disabled={isStreaming}
        voiceButton={
          <VoiceInput
            onTranscript={(t) => handleSend(t)}
            disabled={isStreaming}
          />
        }
      />

      {voiceEnabled && lastAssistantText && (
        <VoiceOutput text={lastAssistantText} enabled={voiceEnabled} />
      )}
    </aside>
  );
}
