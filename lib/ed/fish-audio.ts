/**
 * Fish Audio TTS integration for Ed's voice.
 * Lifted from Schoolgle fish-audio.ts, simplified for MC.
 */

const FISH_AUDIO_API = 'https://api.fish.audio/v1/tts';

interface FishAudioOptions {
  apiKey: string;
  voiceId: string;
}

/**
 * Generate speech audio from text using Fish Audio TTS.
 * Returns an audio/mpeg buffer.
 */
export async function fishAudioSpeak(
  text: string,
  opts: FishAudioOptions,
): Promise<ArrayBuffer> {
  const res = await fetch(FISH_AUDIO_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      reference_id: opts.voiceId,
      format: 'mp3',
      latency: 'balanced',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`Fish Audio TTS failed (${res.status}): ${err}`);
  }

  return res.arrayBuffer();
}
