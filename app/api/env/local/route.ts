/**
 * Local .env.local Reader.
 * GET /api/env/local?repo_path=/Users/david/.openclaw/workspace/mymeme
 * Returns key names only — never values.
 */

import { NextRequest } from 'next/server';
import { readLocalEnvKeys } from '@/lib/env/local-reader';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const repoPath = req.nextUrl.searchParams.get('repo_path');
  if (!repoPath) {
    return Response.json({ error: 'repo_path required' }, { status: 400 });
  }

  try {
    const result = await readLocalEnvKeys(repoPath);
    return Response.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
