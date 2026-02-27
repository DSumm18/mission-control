/**
 * Sentence-level TTS streaming for Ed's voice.
 *
 * POST /api/ed/voice-stream
 * Body: { text: string }
 * Response: SSE stream with base64 audio chunks per sentence.
 *
 * Client plays sentence 1 while sentence 2 is synthesising.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { getTTSProvider, splitSentences, type VoicePersona } from '@/lib/ed/tts-provider';

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function POST(req: NextRequest) {
  const provider = getTTSProvider();
  if (!provider) {
    return Response.json(
      { error: 'TTS not configured (check FISH_AUDIO_API_KEY or NEXT_PUBLIC_FISH_AUDIO_API_KEY)' },
      { status: 503 },
    );
  }

  let text: string;
  let voice: VoicePersona = 'ed';
  try {
    const body = await req.json();
    text = body.text;
    if (body.voice === 'edwina') voice = 'edwina';
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 });
  }

  // Limit text length
  const truncated = text.slice(0, 2000);
  const sentences = splitSentences(truncated);

  if (sentences.length === 0) {
    return Response.json({ error: 'No sentences found' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          try {
            const audio = await provider.synthesize(sentence, voice);
            const base64 = arrayBufferToBase64(audio);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'audio',
                  index: i,
                  total: sentences.length,
                  audio: base64,
                  text: sentence,
                })}\n\n`,
              ),
            );
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', index: i, error: message })}\n\n`,
              ),
            );
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
