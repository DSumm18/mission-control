alter table if exists public.mc_jobs
  add column if not exists command text,
  add column if not exists args jsonb,
  add column if not exists result text,
  add column if not exists error text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

-- defaults for legacy rows
update public.mc_jobs
set command = coalesce(command, prompt_text),
    args = coalesce(args, '[]'::jsonb)
where command is null or args is null;
