/**
 * Ed's Claude backend — uses OpenRouter as proxy for Anthropic API.
 * Supports streaming, prompt caching, multi-turn messages, and model selection.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EdImageAttachment } from './types';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;

function getClient(): Anthropic {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY not set. Add it to .env.local and Vercel environment variables.',
    );
  }
  return new Anthropic({
    apiKey,
    baseURL: 'https://openrouter.ai/api',
  });
}

export interface ClaudeStreamOptions {
  systemPrompt: string;
  messages: Anthropic.MessageCreateParams['messages'];
  images?: EdImageAttachment[];
  model?: string;
}

/**
 * Yields string chunks as Claude streams its response.
 * Uses proper multi-turn messages array and prompt caching on the system prompt.
 */
export async function* claudeStream(
  opts: ClaudeStreamOptions,
): AsyncGenerator<string, void, undefined> {
  const { systemPrompt, messages, model } = opts;
  const client = getClient();

  const stream = client.messages.stream({
    model: model || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
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
  model?: string,
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  return textBlocks.map((b) => b.text).join('');
}
