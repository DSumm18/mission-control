/**
 * Ed's Claude backend — uses Claude CLI via Max plan (zero cost).
 * Supports streaming via --output-format stream-json and non-streaming calls.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

const MC_REPO = '/Users/david/.openclaw/workspace/mission-control';
const DEFAULT_MAX_TOKENS = 4096;
const OPUS_MAX_TOKENS = 8192;

export interface ClaudeStreamOptions {
  systemPrompt: string;
  /** Multi-turn messages array. Last user message text is sent as the prompt. */
  messages: { role: 'user' | 'assistant'; content: string | unknown[] }[];
  model?: string; // 'haiku', 'sonnet', 'opus'
}

/**
 * Flatten messages array into a single prompt string for Claude CLI.
 * CLI doesn't support multi-turn natively, so we format history as context.
 */
function buildPrompt(messages: ClaudeStreamOptions['messages']): string {
  if (messages.length <= 1) {
    const msg = messages[0];
    if (!msg) return '';
    return typeof msg.content === 'string'
      ? msg.content
      : (msg.content as { type: string; text?: string }[])
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text!)
          .join('\n');
  }

  // Format history as context prefix, last user message as the actual prompt
  const parts: string[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    const text =
      typeof m.content === 'string'
        ? m.content
        : (m.content as { type: string; text?: string }[])
            .filter((b) => b.type === 'text' && b.text)
            .map((b) => b.text!)
            .join('\n');
    parts.push(`[${m.role === 'user' ? 'David' : 'Ed'}]: ${text}`);
  }

  const last = messages[messages.length - 1];
  const lastText =
    typeof last.content === 'string'
      ? last.content
      : (last.content as { type: string; text?: string }[])
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text!)
          .join('\n');

  return `Previous conversation:\n${parts.join('\n')}\n\n[David]: ${lastText}`;
}

/**
 * Yields string chunks as Claude CLI streams its response.
 * Uses --output-format stream-json for real-time text.
 */
export async function* claudeStream(
  opts: ClaudeStreamOptions,
): AsyncGenerator<string, void, undefined> {
  const { systemPrompt, messages, model } = opts;
  const prompt = buildPrompt(messages);
  if (!prompt) return;

  const cliModel = model || 'haiku';
  const maxTokens =
    cliModel === 'opus' ? OPUS_MAX_TOKENS : DEFAULT_MAX_TOKENS;

  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', cliModel,
    '--max-turns', '1',
    '--system-prompt', systemPrompt,
    '--no-session-persistence',
    '--permission-mode', 'bypassPermissions',
    prompt,
  ];

  // Unset CLAUDECODE to allow nested CLI calls
  const env = { ...process.env };
  delete env.CLAUDECODE;

  const child = spawn('claude', args, {
    env,
    cwd: MC_REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let lastContent = '';

  const rl = createInterface({ input: child.stdout!, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      let parsed: {
        type?: string;
        subtype?: string;
        message?: { content?: { type: string; text?: string }[] };
        result?: string;
      };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      // Handle assistant message updates (partial messages with --include-partial-messages)
      if (parsed.type === 'assistant' && parsed.message?.content) {
        const textBlocks = parsed.message.content.filter(
          (b) => b.type === 'text' && b.text,
        );
        const fullText = textBlocks.map((b) => b.text!).join('');
        if (fullText.length > lastContent.length) {
          const delta = fullText.slice(lastContent.length);
          lastContent = fullText;
          yield delta;
        }
      }

      // Handle result event (final)
      if (parsed.type === 'result' && parsed.result) {
        if (parsed.result.length > lastContent.length) {
          const delta = parsed.result.slice(lastContent.length);
          yield delta;
        }
      }
    }
  } finally {
    child.kill('SIGTERM');
  }
}

/**
 * Non-streaming Claude CLI call. Used for quick operations.
 * Returns the full response text.
 */
export async function claudeCall(
  systemPrompt: string,
  userMessage: string,
  model?: string,
): Promise<string> {
  const cliModel = model || 'haiku';

  const args = [
    '-p',
    '--output-format', 'json',
    '--verbose',
    '--model', cliModel,
    '--max-turns', '1',
    '--system-prompt', systemPrompt,
    '--no-session-persistence',
    '--permission-mode', 'bypassPermissions',
    userMessage,
  ];

  const env = { ...process.env };
  delete env.CLAUDECODE;

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      env,
      cwd: MC_REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout!.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr!.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`Claude CLI exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }

      // Parse JSON output — result field contains the text
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed.result || '');
      } catch {
        // If not valid JSON, return raw stdout
        resolve(stdout.trim());
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Claude CLI spawn error: ${err.message}`));
    });
  });
}
