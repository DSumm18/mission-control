-- Mission Control Jobs table (MVP)
create table if not exists mc_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  engine text not null check (engine in ('claude','gemini','openai','shell')),
  repo_path text not null,
  prompt_text text not null,
  output_dir text not null,
  status text not null default 'queued' check (status in ('queued','running','paused_human','paused_quota','done','failed')),
  last_run_json jsonb,
  last_log_path text,
  last_error text
);

alter table mc_jobs enable row level security;

create policy if not exists "mc_jobs_authed_all_select" on mc_jobs
for select using (auth.role() = 'authenticated');

create policy if not exists "mc_jobs_authed_all_insert" on mc_jobs
for insert with check (auth.role() = 'authenticated');

create policy if not exists "mc_jobs_authed_all_update" on mc_jobs
for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy if not exists "mc_jobs_authed_all_delete" on mc_jobs
for delete using (auth.role() = 'authenticated');
