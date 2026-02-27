'use client';

import { useEffect, useRef } from 'react';

interface VoiceOutputProps {
  text: string;
  enabled: boolean;
}

export default function VoiceOutput({ text, enabled }: VoiceOutputProps) {
  const lastSpokenRef = useRef('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || !text || text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Try Fish Audio first, fall back to browser TTS
    async function speak() {
      try {
        const res = await fetch('/api/ed/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.slice(0, 1000) }), // Limit to ~1000 chars for TTS
        });

        if (res.ok && res.body) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.play().catch(() => {
            // Fish Audio failed — fall back to browser TTS
            fallbackTTS(text);
          });
          audio.onended = () => URL.revokeObjectURL(url);
          return;
        }
      } catch {
        // Fish Audio unavailable
      }

      // Fallback: browser speech synthesis
      fallbackTTS(text);
    }

    speak();
  }, [text, enabled]);

  return null;
}

function fallbackTTS(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
  utterance.lang = 'en-GB';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Try to find a good British English voice
  const voices = window.speechSynthesis.getVoices();
  const british = voices.find(
    (v) => v.lang === 'en-GB' && v.name.toLowerCase().includes('male'),
  );
  if (british) utterance.voice = british;

  window.speechSynthesis.speak(utterance);
}
