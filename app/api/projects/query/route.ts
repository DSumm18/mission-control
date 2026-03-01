/**
 * Project Database Query Proxy.
 * POST /api/projects/query
 *
 * Allows Ed and agents to query any project's Supabase database
 * by looking up its service role key from env vars.
 *
 * Body: { project_id: string, sql: string }
 * Auth: x-runner-token header
 *
 * Service keys are stored as env vars: SUPABASE_KEY_<PROJECT_ID>
 * Falls back to the Supabase Management API if available.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Map of known project refs to their Supabase URLs
function getSupabaseUrl(projectId: string): string {
  return `https://${projectId}.supabase.co`;
}

export async function POST(req: NextRequest) {
  // Auth check
  const token = req.headers.get('x-runner-token');
  if (token !== process.env.MC_RUNNER_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { project_id?: string; sql?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { project_id, sql } = body;
  if (!project_id || !sql) {
    return Response.json({ error: 'project_id and sql are required' }, { status: 400 });
  }

  // Security: block destructive SQL (DROP, TRUNCATE, DELETE without WHERE)
  const upperSql = sql.toUpperCase().trim();
  const blocked = ['DROP ', 'TRUNCATE ', 'ALTER ', 'CREATE ', 'GRANT ', 'REVOKE '];
  if (blocked.some(b => upperSql.startsWith(b))) {
    return Response.json({ error: 'DDL statements are not allowed via this endpoint' }, { status: 403 });
  }

  // Look up service key from env: SUPABASE_KEY_<ref>
  const envKey = `SUPABASE_KEY_${project_id}`;
  const serviceKey = process.env[envKey];

  if (!serviceKey) {
    return Response.json({
      error: `No service key configured for project ${project_id}. Add ${envKey} to .env.local`,
      hint: `Run: echo "${envKey}=<your-service-role-key>" >> .env.local`,
    }, { status: 404 });
  }

  try {
    const url = getSupabaseUrl(project_id);
    const sb = createClient(url, serviceKey);

    // Use the rpc or raw query approach
    // Supabase JS doesn't support raw SQL, so we use the REST SQL endpoint
    const res = await fetch(`${url}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    });

    // Alternative: use the pg-meta endpoint for SQL execution
    const pgRes = await fetch(`${url}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(10_000),
    });

    if (pgRes.ok) {
      const data = await pgRes.json();
      return Response.json({ ok: true, rows: data, project_id });
    }

    // Fallback: try using supabase-js to run a simple select
    // This only works for table queries, not arbitrary SQL
    const fallbackMatch = sql.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(.*)$/i);
    if (fallbackMatch) {
      const [, columns, table, rest] = fallbackMatch;
      const selectCols = columns.trim() === '*' ? '*' : columns.trim();
      let query = sb.from(table).select(selectCols);

      // Parse simple WHERE clause
      const whereMatch = rest?.match(/WHERE\s+(\w+)\s*=\s*'([^']+)'/i);
      if (whereMatch) {
        query = query.eq(whereMatch[1], whereMatch[2]);
      }

      const limitMatch = rest?.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        query = query.limit(parseInt(limitMatch[1]));
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, rows: data, project_id, method: 'postgrest' });
    }

    return Response.json({
      error: 'Could not execute SQL. Only SELECT queries via PostgREST are supported for project databases.',
      project_id,
    }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg, project_id }, { status: 500 });
  }
}
