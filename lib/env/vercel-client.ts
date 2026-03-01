/**
 * Vercel REST API client for environment variable management.
 * Uses VERCEL_TOKEN from process.env. All calls are server-side only.
 */

const VERCEL_API = 'https://api.vercel.com';

function getToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN not configured');
  return token;
}

function teamParam(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${teamId}` : '';
}

export interface VercelEnvVar {
  id: string;
  key: string;
  value?: string;
  target: string[];
  type: 'encrypted' | 'plain' | 'secret' | 'sensitive';
  updatedAt: number;
}

export async function listEnvVars(vercelProjectId: string): Promise<VercelEnvVar[]> {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${vercelProjectId}/env${teamParam()}`,
    {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vercel API ${res.status}: ${(err as Record<string, { message?: string }>).error?.message || res.statusText}`);
  }
  const data = await res.json();
  return (data.envs || []) as VercelEnvVar[];
}

export async function createEnvVar(
  vercelProjectId: string,
  key: string,
  value: string,
  target: string[] = ['production', 'preview', 'development'],
  type: 'encrypted' | 'plain' = 'encrypted',
): Promise<VercelEnvVar> {
  const res = await fetch(
    `${VERCEL_API}/v10/projects/${vercelProjectId}/env${teamParam()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, value, target, type }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vercel API ${res.status}: ${(err as Record<string, { message?: string }>).error?.message || res.statusText}`);
  }
  return (await res.json()) as VercelEnvVar;
}

export async function updateEnvVar(
  vercelProjectId: string,
  envId: string,
  value: string,
): Promise<VercelEnvVar> {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${vercelProjectId}/env/${envId}${teamParam()}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vercel API ${res.status}: ${(err as Record<string, { message?: string }>).error?.message || res.statusText}`);
  }
  return (await res.json()) as VercelEnvVar;
}

export async function deleteEnvVar(
  vercelProjectId: string,
  envId: string,
): Promise<void> {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${vercelProjectId}/env/${envId}${teamParam()}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vercel API ${res.status}: ${(err as Record<string, { message?: string }>).error?.message || res.statusText}`);
  }
}
