/**
 * Ed's Claude backend — uses Anthropic API directly (works on Vercel + local).
 * Replaces the old Claude CLI spawn approach that only worked on the Mac Mini.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EdImageAttachment } from './types';

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Add it to .env.local and Vercel environment variables.',
    );
  }
  return new Anthropic({ apiKey });
}

export interface ClaudeStreamOptions {
  systemPrompt: string;
  userMessage: string;
  images?: EdImageAttachment[];
}

/**
 * Yields string chunks as Claude streams its response.
 */
export async function* claudeStream(
  opts: ClaudeStreamOptions,
): AsyncGenerator<string, void, undefined> {
  const { systemPrompt, userMessage, images } = opts;
  const client = getClient();

  // Build content blocks
  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  // Add images if present
  if (images?.length) {
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: img.base64,
        },
      });
    }
  }

  // Add text
  content.push({ type: 'text', text: userMessage });

  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

/**
 * Non-streaming Claude API call. Used for quick operations.
 * Returns the full response text.
 */
export async function claudeCall(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  return textBlocks.map((b) => b.text).join('');
}
