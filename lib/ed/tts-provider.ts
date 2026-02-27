/**
 * TTS provider abstraction for Ed's voice.
 * Currently supports Fish Audio. Ready for Cartesia/ElevenLabs swap via TTS_PROVIDER env var.
 */

export interface TTSProvider {
  name: string;
  synthesize(text: string, persona?: VoicePersona): Promise<ArrayBuffer>;
}

export type VoicePersona = 'ed' | 'edwina';

/** Fish Audio TTS provider */
class FishAudioProvider implements TTSProvider {
  name = 'fish-audio';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getVoiceId(persona: VoicePersona): string | null {
    if (persona === 'edwina') {
      return process.env.FISH_AUDIO_VOICE_ID_EDWINA
        || process.env.NEXT_PUBLIC_FISH_AUDIO_VOICE_ID_EDWINA
        || null;
    }
    return process.env.FISH_AUDIO_VOICE_ID_ED
      || process.env.NEXT_PUBLIC_FISH_AUDIO_VOICE_ID_ED
      || null;
  }

  async synthesize(text: string, persona: VoicePersona = 'ed'): Promise<ArrayBuffer> {
    const voiceId = this.getVoiceId(persona);
    if (!voiceId) {
      throw new Error(`No voice ID configured for persona "${persona}"`);
    }

    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
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
      if (!apiKey) return null;
      return new FishAudioProvider(apiKey);
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
