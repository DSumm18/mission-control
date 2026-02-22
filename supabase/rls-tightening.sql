-- Minimal RLS tightening for Mission Control MVP

-- Project membership model
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role app_role not null default 'viewer',
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

alter table project_members enable row level security;

-- Add project scoping columns where missing
alter table artifacts add column if not exists project_id uuid references projects(id) on delete set null;
alter table activity_logs add column if not exists project_id uuid references projects(id) on delete set null;

-- Remove broad authenticated read policies (if they exist)
drop policy if exists "projects_read_all_authed" on projects;
drop policy if exists "tasks_read_all_authed" on tasks;
drop policy if exists "decisions_read_all_authed" on decisions;
drop policy if exists "logs_read_all_authed" on activity_logs;

-- Helper policy pattern: user must be project member for project-scoped reads
create policy if not exists "project_members_self_read" on project_members
for select using (auth.uid() = user_id);

create policy if not exists "projects_project_scoped_read" on projects
for select using (
  exists (select 1 from project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid())
);

create policy if not exists "tasks_project_scoped_read" on tasks
for select using (
  project_id is not null and exists (select 1 from project_members pm where pm.project_id = tasks.project_id and pm.user_id = auth.uid())
);

create policy if not exists "artifacts_project_scoped_read" on artifacts
for select using (
  project_id is not null and exists (select 1 from project_members pm where pm.project_id = artifacts.project_id and pm.user_id = auth.uid())
);

create policy if not exists "logs_project_scoped_read" on activity_logs
for select using (
  project_id is not null and exists (select 1 from project_members pm where pm.project_id = activity_logs.project_id and pm.user_id = auth.uid())
);

-- decisions: owner/admin only
create policy if not exists "decisions_owner_admin_only" on decisions
for all using (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role in ('owner','admin'))
)
with check (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role in ('owner','admin'))
);

-- integrations + schedules: owner/admin only
create policy if not exists "integrations_owner_admin_only" on integrations
for all using (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role in ('owner','admin'))
)
with check (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role in ('owner','admin'))
);

create policy if not exists "schedules_owner_admin_only" on schedules
for all using (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role in ('owner','admin'))
)
with check (
  exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role in ('owner','admin'))
);
