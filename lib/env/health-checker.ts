/**
 * Env var health checker.
 * Compares manifest (expected) vs Vercel (deployed) vs local (.env.local).
 * Computes a health score and caches results in mc_env_health.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import { listEnvVars } from './vercel-client';
import { readLocalEnvKeys } from './local-reader';

export interface EnvHealthReport {
  project_id: string;
  project_name: string;
  vercel_keys: string[];
  local_keys: string[];
  manifest_keys: string[];
  missing_vercel: string[];
  missing_local: string[];
  extra_vercel: string[];
  extra_local: string[];
  health_score: number;
  checked_at: string;
}

export async function checkProjectEnvHealth(projectId: string): Promise<EnvHealthReport> {
  const sb = supabaseAdmin();

  // Get project details
  const { data: project, error: projErr } = await sb
    .from('mc_projects')
    .select('id, name, vercel_project_id, repo_path')
    .eq('id', projectId)
    .single();

  if (projErr || !project) throw new Error(`Project not found: ${projectId}`);

  // 1. Get manifest keys (what's expected)
  const { data: manifest } = await sb
    .from('mc_env_manifest')
    .select('key_name, required')
    .eq('project_id', projectId);
  const manifestKeys = (manifest || []).map(m => m.key_name);
  const requiredKeys = (manifest || []).filter(m => m.required).map(m => m.key_name);

  // 2. Get Vercel keys
  let vercelKeys: string[] = [];
  if (project.vercel_project_id) {
    try {
      const envVars = await listEnvVars(project.vercel_project_id);
      vercelKeys = envVars.map(e => e.key);
    } catch {
      // Vercel API error — don't fail the whole check
    }
  }

  // 3. Get local keys
  let localKeys: string[] = [];
  if (project.repo_path) {
    try {
      const local = await readLocalEnvKeys(project.repo_path);
      localKeys = local.keys;
    } catch {
      // File read error — don't fail
    }
  }

  // 4. Compute diffs
  const vercelSet = new Set(vercelKeys);
  const localSet = new Set(localKeys);
  const manifestSet = new Set(manifestKeys);

  const missing_vercel = manifestKeys.filter(k => !vercelSet.has(k));
  const missing_local = manifestKeys.filter(k => !localSet.has(k));
  const extra_vercel = vercelKeys.filter(k => !manifestSet.has(k));
  const extra_local = localKeys.filter(k => !manifestSet.has(k));

  // 5. Health score: start at 100, deduct for issues
  let score = 100;
  const requiredMissingVercel = requiredKeys.filter(k => !vercelSet.has(k));
  score -= requiredMissingVercel.length * 15; // required missing from Vercel is serious
  score -= missing_vercel.length * 5; // optional missing from Vercel
  score -= missing_local.length * 2; // missing local is less critical
  score = Math.max(0, Math.min(100, score));

  const now = new Date().toISOString();

  // 6. Cache in mc_env_health
  await sb.from('mc_env_health').upsert(
    {
      project_id: projectId,
      checked_at: now,
      vercel_keys: vercelKeys,
      local_keys: localKeys,
      manifest_keys: manifestKeys,
      missing_vercel,
      missing_local,
      extra_vercel,
      extra_local,
      health_score: score,
    },
    { onConflict: 'project_id' },
  );

  return {
    project_id: projectId,
    project_name: project.name,
    vercel_keys: vercelKeys,
    local_keys: localKeys,
    manifest_keys: manifestKeys,
    missing_vercel,
    missing_local,
    extra_vercel,
    extra_local,
    health_score: score,
    checked_at: now,
  };
}

export async function checkAllProjectsEnvHealth(): Promise<EnvHealthReport[]> {
  const sb = supabaseAdmin();
  const { data: projects } = await sb
    .from('mc_projects')
    .select('id')
    .eq('status', 'active');

  const reports: EnvHealthReport[] = [];
  for (const p of projects || []) {
    try {
      reports.push(await checkProjectEnvHealth(p.id));
    } catch {
      // Skip failed projects
    }
  }
  return reports;
}
