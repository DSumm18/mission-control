/**
 * AsyncGenerator that spawns `claude -p` and yields stdout chunks
 * instead of collecting all output. Used for SSE streaming.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { EdImageAttachment } from './types';

const CLAUDE_CLI = '/opt/homebrew/bin/claude';
const CLAUDE_TIMEOUT = 180_000; // 180s

export interface ClaudeStreamOptions {
  systemPrompt: string;
  userMessage: string;
  images?: EdImageAttachment[];
}

/**
 * Yields string chunks as Claude CLI writes to stdout.
 * Throws on timeout or non-zero exit with no output.
 */
export async function* claudeStream(
  opts: ClaudeStreamOptions,
): AsyncGenerator<string, void, undefined> {
  const { systemPrompt, userMessage, images } = opts;

  const args = ['-p', '--output-format', 'stream-json'];

  // If we have images, write them to temp files and pass via CLI
  const tempFiles: string[] = [];
  if (images?.length) {
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'ed-img-'));

    for (const img of images) {
      const ext = img.mimeType.split('/')[1] || 'png';
      const path = join(dir, `img-${tempFiles.length}.${ext}`);
      writeFileSync(path, Buffer.from(img.base64, 'base64'));
      tempFiles.push(path);
    }

    // Claude CLI supports --image flag for vision
    for (const f of tempFiles) {
      args.push('--image', f);
    }
  }

  // Unset CLAUDECODE to allow nested CLI calls
  const env = { ...process.env };
  delete env.CLAUDECODE;

  let proc: ChildProcess | null = null;

  try {
    proc = spawn(CLAUDE_CLI, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      proc?.kill('SIGTERM');
    }, CLAUDE_TIMEOUT);

    // Write system prompt + user message via stdin
    proc.stdin!.write(
      `${systemPrompt}\n\n---\n\n${userMessage}`,
    );
    proc.stdin!.end();

    // Stream stdout chunks
    for await (const chunk of proc.stdout! as AsyncIterable<Buffer>) {
      const text = chunk.toString('utf-8');
      // stream-json outputs one JSON object per line
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          // stream-json format: { type: "assistant", content: [...] } or { type: "content_block_delta", ... }
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          } else if (parsed.type === 'result' && parsed.result) {
            // Final result — yield any remaining text
            if (typeof parsed.result === 'string') {
              yield parsed.result;
            }
          }
        } catch {
          // Not JSON — yield as raw text (fallback)
          yield line;
        }
      }
    }

    clearTimeout(timer);

    // Wait for process to close
    await new Promise<void>((resolve, reject) => {
      proc!.on('close', (code) => {
        if (code !== 0 && code !== null) {
          // Only reject if we got no output at all
          reject(new Error(`Claude CLI exited with code ${code}`));
        } else {
          resolve();
        }
      });
      proc!.on('error', reject);
    });
  } finally {
    // Clean up temp image files
    if (tempFiles.length) {
      const { unlinkSync, rmdirSync } = await import('node:fs');
      const { dirname } = await import('node:path');
      for (const f of tempFiles) {
        try { unlinkSync(f); } catch { /* ignore */ }
      }
      try { rmdirSync(dirname(tempFiles[0])); } catch { /* ignore */ }
    }
  }
}

/**
 * Non-streaming Claude CLI call. Used for quick operations.
 * Returns the full response text.
 */
export async function claudeCall(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const env = { ...process.env };
  delete env.CLAUDECODE;

  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_CLI, ['-p', '--system-prompt', systemPrompt], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Claude CLI timed out after 180s'));
    }, CLAUDE_TIMEOUT);

    proc.stdin.write(userMessage);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d; });
    proc.stderr.on('data', (d: Buffer) => { stderr += d; });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.length > 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Claude CLI exited ${code}: ${stderr.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
