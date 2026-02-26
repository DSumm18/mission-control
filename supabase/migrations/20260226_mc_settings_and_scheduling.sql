-- mc_settings: global key/value config for scheduler flags
create table if not exists mc_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table mc_settings enable row level security;

-- drop policies first in case they exist, then recreate
drop policy if exists "mc_settings_authed_select" on mc_settings;
create policy "mc_settings_authed_select" on mc_settings
for select using (auth.role() = 'authenticated');

drop policy if exists "mc_settings_authed_mutate" on mc_settings;
create policy "mc_settings_authed_mutate" on mc_settings
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- seed initial settings
insert into mc_settings (key, value) values
  ('pause_all', '{"enabled": false}'::jsonb),
  ('max_concurrency', '{"limit": 2}'::jsonb)
on conflict (key) do nothing;

-- add scheduling + MCP columns to mc_jobs
alter table if exists public.mc_jobs
  add column if not exists schedule_cron text,
  add column if not exists next_run_at timestamptz,
  add column if not exists last_run_at timestamptz,
  add column if not exists max_retries int not null default 1,
  add column if not exists retry_count int not null default 0,
  add column if not exists mcp_servers text[] not null default '{}';

-- index for scheduler polling: find due queued jobs efficiently
create index if not exists idx_mc_jobs_next_run
  on mc_jobs (status, next_run_at)
  where status = 'queued';
