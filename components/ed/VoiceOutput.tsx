'use client';

import { useEffect, useRef, useCallback } from 'react';

export type VoicePersona = 'ed' | 'edwina';

interface VoiceOutputProps {
  text: string;
  enabled: boolean;
  voice?: VoicePersona;
}

/** Strip markdown syntax so TTS doesn't read "asterisk asterisk" etc. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')        // *italic* → italic
    .replace(/__([^_]+)__/g, '$1')        // __bold__ → bold
    .replace(/_([^_]+)_/g, '$1')          // _italic_ → italic
    .replace(/~~([^~]+)~~/g, '$1')        // ~~strike~~ → strike
    .replace(/`([^`]+)`/g, '$1')          // `code` → code
    .replace(/^#{1,6}\s+/gm, '')          // # heading → heading
    .replace(/^\s*[-*+]\s+/gm, '')        // - list item → list item
    .replace(/^\s*\d+\.\s+/gm, '')        // 1. list item → list item
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) → link
    .replace(/\[MC_ACTION:[^\]]*\].*?\[\/MC_ACTION\]/gs, '') // strip action blocks
    .replace(/<!--.*?-->/gs, '')          // strip HTML comments
    .replace(/\n{3,}/g, '\n\n')           // collapse excess newlines
    .trim();
}

/**
 * Sentence-level voice output for Ed.
 * Streams audio per sentence — plays sentence 1 while sentence 2 synthesises.
 */
export default function VoiceOutput({ text, enabled, voice = 'ed' }: VoiceOutputProps) {
  const lastSpokenRef = useRef('');
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const playNext = useCallback(() => {
    if (!isPlayingRef.current && audioQueueRef.current.length > 0) {
      isPlayingRef.current = true;
      const audio = audioQueueRef.current.shift()!;
      audio.onended = () => {
        isPlayingRef.current = false;
        playNext();
      };
      audio.onerror = () => {
        isPlayingRef.current = false;
        playNext();
      };
      audio.play().catch(() => {
        isPlayingRef.current = false;
        playNext();
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !text || text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;

    // Abort any in-flight stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // Stop any queued/playing audio
    for (const audio of audioQueueRef.current) {
      audio.pause();
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;

    const cleanText = stripMarkdown(text);
    if (!cleanText) return;

    async function streamVoice() {
      try {
        const res = await fetch('/api/ed/voice-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText.slice(0, 2000), voice }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          fallbackTTS(text);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'audio' && data.audio) {
                // Decode base64 to audio blob
                const binary = atob(data.audio);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.onended = () => URL.revokeObjectURL(url);

                audioQueueRef.current.push(audio);
                playNext();
              }
            } catch {
              // Skip malformed SSE
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        fallbackTTS(text);
      }
    }

    streamVoice();

    return () => {
      controller.abort();
    };
  }, [text, enabled, voice, playNext]);

  return null;
}

function fallbackTTS(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(stripMarkdown(text).slice(0, 500));
  utterance.lang = 'en-GB';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const british = voices.find(
    (v) => v.lang === 'en-GB' && v.name.toLowerCase().includes('male'),
  );
  if (british) utterance.voice = british;

  window.speechSynthesis.speak(utterance);
}
