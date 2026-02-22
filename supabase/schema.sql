-- Mission Control v1 schema
create extension if not exists pgcrypto;

create type app_role as enum ('owner','admin','editor','viewer','system');
create type decision_status as enum ('pending','approved','rejected','changes_requested');
create type task_status as enum ('queued','running','completed','failed','blocked');

create table if not exists users (
  id uuid primary key,
  email text unique,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz default now(),
  unique(user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text,
  percent_complete int default 0,
  blocker text,
  confidence text,
  source_payload jsonb,
  created_at timestamptz default now()
);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  definition jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  title text not null,
  description text,
  status task_status not null default 'queued',
  created_by uuid references users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists llm_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  provider text not null,
  model text not null,
  status text not null,
  output_json jsonb,
  qa_flags text[] default '{}',
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  llm_run_id uuid references llm_runs(id) on delete set null,
  type text not null,
  status decision_status not null default 'pending',
  title text not null,
  payload jsonb,
  requested_by uuid references users(id),
  decided_by uuid references users(id),
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  type text not null,
  storage_path text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists kpis (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value_numeric numeric,
  value_text text,
  as_of timestamptz default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  cron_expr text not null,
  endpoint text not null,
  enabled boolean default true,
  last_run_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  status text not null,
  config jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table users enable row level security;
alter table user_roles enable row level security;
alter table projects enable row level security;
alter table workflows enable row level security;
alter table tasks enable row level security;
alter table decisions enable row level security;
alter table artifacts enable row level security;
alter table activity_logs enable row level security;
alter table llm_runs enable row level security;
alter table kpis enable row level security;
alter table schedules enable row level security;
alter table integrations enable row level security;

-- Basic policies (service role bypasses RLS by default)
create policy if not exists "users_self_read" on users for select using (auth.uid() = id);
create policy if not exists "users_self_update" on users for update using (auth.uid() = id);

create policy if not exists "roles_self_read" on user_roles for select using (auth.uid() = user_id);

create policy if not exists "projects_read_all_authed" on projects for select using (auth.role() = 'authenticated');
create policy if not exists "tasks_read_all_authed" on tasks for select using (auth.role() = 'authenticated');
create policy if not exists "decisions_read_all_authed" on decisions for select using (auth.role() = 'authenticated');
create policy if not exists "logs_read_all_authed" on activity_logs for select using (auth.role() = 'authenticated');

-- Seed schedule for task runner endpoint
insert into schedules(task_name, cron_expr, endpoint, enabled)
values ('task-runner', '*/5 * * * *', '/api/tasks/run', true)
on conflict do nothing;
