alter table if exists public.mc_jobs
  drop constraint if exists mc_jobs_status_check;

alter table if exists public.mc_jobs
  add constraint mc_jobs_status_check
  check (status in ('queued','running','paused_human','paused_quota','paused_proxy','done','failed'));
