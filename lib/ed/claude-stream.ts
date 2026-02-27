/**
 * Ed's Claude backend — uses OpenRouter as proxy for Anthropic API.
 * Supports streaming, prompt caching, multi-turn messages, and model selection.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EdImageAttachment } from './types';

const MAX_TOKENS = 4096;

/** Whether we're using OpenRouter or direct Anthropic */
let _useOpenRouter: boolean | null = null;

function useOpenRouter(): boolean {
  if (_useOpenRouter === null) {
    _useOpenRouter = !!process.env.OPENROUTER_API_KEY;
  }
  return _useOpenRouter;
}

/** Default model — prefixed for OpenRouter, plain for direct Anthropic */
function defaultModel(): string {
  return useOpenRouter()
    ? 'anthropic/claude-sonnet-4-5-20250929'
    : 'claude-sonnet-4-5-20250929';
}

function getClient(): Anthropic {
  if (useOpenRouter()) {
    const key = process.env.OPENROUTER_API_KEY!;
    return new Anthropic({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api',
      defaultHeaders: {
        'Authorization': `Bearer ${key}`,
      },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Neither OPENROUTER_API_KEY nor ANTHROPIC_API_KEY is set. Add one to .env.local and Vercel environment variables.',
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Strip the anthropic/ prefix from model names when using direct Anthropic API.
 */
function resolveModel(model: string | undefined): string {
  const m = model || defaultModel();
  if (!useOpenRouter() && m.startsWith('anthropic/')) {
    return m.replace('anthropic/', '');
  }
  return m;
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
    model: resolveModel(model),
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
    model: resolveModel(model),
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
