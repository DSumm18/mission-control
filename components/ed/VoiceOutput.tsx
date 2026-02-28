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

// Shared AudioContext — must be unlocked on user gesture for iOS
let audioCtx: AudioContext | null = null;

/**
 * Call this from a user gesture handler (e.g. Send button tap)
 * to unlock audio playback on iOS Safari / PWA.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  // Play a silent buffer to fully unlock on iOS
  const buffer = audioCtx.createBuffer(1, 1, 22050);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Sentence-level voice output for Ed.
 * Uses Web Audio API (AudioContext) for iOS Safari / PWA compatibility.
 * Streams audio per sentence — plays sentence 1 while sentence 2 synthesises.
 */
export default function VoiceOutput({ text, enabled, voice = 'ed' }: VoiceOutputProps) {
  const lastSpokenRef = useRef('');
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const playNext = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx || isPlayingRef.current || audioQueueRef.current.length === 0) return;

    isPlayingRef.current = true;
    const buf = audioQueueRef.current.shift()!;

    // Ensure context is running
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    ctx.decodeAudioData(
      buf,
      (audioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        currentSourceRef.current = source;
        source.onended = () => {
          currentSourceRef.current = null;
          isPlayingRef.current = false;
          playNext();
        };
        source.start(0);
      },
      () => {
        // Decode error — skip to next
        isPlayingRef.current = false;
        playNext();
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled || !text || text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;

    // Abort any in-flight stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // Stop current playback
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch { /* already stopped */ }
      currentSourceRef.current = null;
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
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'audio' && data.audio) {
                // Decode base64 to ArrayBuffer for Web Audio API
                const binary = atob(data.audio);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                audioQueueRef.current.push(bytes.buffer);
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
