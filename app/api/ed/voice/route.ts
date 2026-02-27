/**
 * Fish Audio TTS proxy for Ed's voice.
 *
 * POST /api/ed/voice
 * Body: { text: string }
 * Response: audio/mpeg stream
 */

import { NextRequest } from 'next/server';
import { fishAudioSpeak } from '@/lib/ed/fish-audio';

export async function POST(req: NextRequest) {
  const apiKey = process.env.FISH_AUDIO_API_KEY || process.env.NEXT_PUBLIC_FISH_AUDIO_API_KEY;
  const voiceId = process.env.FISH_AUDIO_VOICE_ID_ED || process.env.NEXT_PUBLIC_FISH_AUDIO_VOICE_ID_ED;

  if (!apiKey || !voiceId) {
    return Response.json(
      { error: 'Fish Audio not configured (FISH_AUDIO_API_KEY / FISH_AUDIO_VOICE_ID_ED)' },
      { status: 503 },
    );
  }

  let text: string;
  try {
    const body = await req.json();
    text = body.text;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 });
  }

  // Limit text length to prevent abuse
  const truncated = text.slice(0, 2000);

  try {
    const audio = await fishAudioSpeak(truncated, { apiKey, voiceId });

    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
