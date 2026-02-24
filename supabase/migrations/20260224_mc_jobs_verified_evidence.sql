alter table if exists public.mc_jobs
  add column if not exists verified_at timestamptz null,
  add column if not exists evidence_log_path text null,
  add column if not exists evidence_sha256 text null;
