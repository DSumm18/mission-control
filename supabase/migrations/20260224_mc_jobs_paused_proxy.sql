do $$
begin
  -- replace existing status check constraint if present
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'mc_jobs'
      and c.conname = 'mc_jobs_status_check'
  ) then
    alter table public.mc_jobs drop constraint mc_jobs_status_check;
  end if;

  alter table public.mc_jobs
    add constraint mc_jobs_status_check
    check (status in ('queued','running','paused_human','paused_quota','paused_proxy','done','failed'));
end
$$;
