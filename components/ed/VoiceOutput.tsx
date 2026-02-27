'use client';

import { useEffect, useRef, useCallback } from 'react';

interface VoiceOutputProps {
  text: string;
  enabled: boolean;
}

/**
 * Sentence-level voice output for Ed.
 * Streams audio per sentence — plays sentence 1 while sentence 2 synthesises.
 */
export default function VoiceOutput({ text, enabled }: VoiceOutputProps) {
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

    async function streamVoice() {
      try {
        const res = await fetch('/api/ed/voice-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.slice(0, 2000) }),
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
  }, [text, enabled, playNext]);

  return null;
}

function fallbackTTS(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
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
