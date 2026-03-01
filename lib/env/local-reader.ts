/**
 * Read .env.local files from project repo paths on disk.
 * Returns key NAMES only — never exposes values through the API.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface LocalEnvResult {
  exists: boolean;
  keys: string[];
  path: string;
}

export async function readLocalEnvKeys(repoPath: string): Promise<LocalEnvResult> {
  const envPath = path.join(repoPath, '.env.local');

  if (!existsSync(envPath)) {
    return { exists: false, keys: [], path: envPath };
  }

  const content = await readFile(envPath, 'utf-8');
  const keys = content
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) return null;
      return line.slice(0, eqIdx).trim();
    })
    .filter((k): k is string => Boolean(k));

  return { exists: true, keys, path: envPath };
}
