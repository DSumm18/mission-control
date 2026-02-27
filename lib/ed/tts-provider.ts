/**
 * TTS provider abstraction for Ed's voice.
 * Currently supports Fish Audio. Ready for Cartesia/ElevenLabs swap via TTS_PROVIDER env var.
 */

export interface TTSProvider {
  name: string;
  synthesize(text: string): Promise<ArrayBuffer>;
}

/** Fish Audio TTS provider */
class FishAudioProvider implements TTSProvider {
  name = 'fish-audio';
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey: string, voiceId: string) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async synthesize(text: string): Promise<ArrayBuffer> {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_id: this.voiceId,
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
}

/** Get the configured TTS provider */
export function getTTSProvider(): TTSProvider | null {
  const provider = process.env.TTS_PROVIDER || 'fish-audio';

  switch (provider) {
    case 'fish-audio': {
      const apiKey = process.env.FISH_AUDIO_API_KEY || process.env.NEXT_PUBLIC_FISH_AUDIO_API_KEY;
      const voiceId = process.env.FISH_AUDIO_VOICE_ID_ED || process.env.NEXT_PUBLIC_FISH_AUDIO_VOICE_ID_ED;
      if (!apiKey || !voiceId) return null;
      return new FishAudioProvider(apiKey, voiceId);
    }
    default:
      return null;
  }
}

/**
 * Split text into sentences for streaming TTS.
 * Returns complete sentences as they're found.
 */
export function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end of string
  const parts = text.match(/[^.!?]*[.!?]+[\s]?|[^.!?]+$/g) || [];
  return parts
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
