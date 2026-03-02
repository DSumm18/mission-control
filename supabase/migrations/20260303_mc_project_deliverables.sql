-- Mission Control: Project Deliverables & Planning Gate
-- Surfaces planning documents (PRDs, specs, research) within projects
-- with review/approval workflow before dev begins.

---------------------------------------------------------------------
-- 1. NEW TABLE
---------------------------------------------------------------------

create table if not exists mc_project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references mc_projects(id) on delete cascade,
  source_job_id uuid references mc_jobs(id) on delete set null,
  title text not null,
  deliverable_type text not null default 'other'
    check (deliverable_type in ('prd','spec','research','analysis','design','other')),
  content text not null default '',
  status text not null default 'draft'
    check (status in ('draft','review','approved','rejected')),
  feedback text,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

---------------------------------------------------------------------
-- 2. INDEXES
---------------------------------------------------------------------

create index if not exists idx_mc_project_deliverables_project_id
  on mc_project_deliverables(project_id);
create index if not exists idx_mc_project_deliverables_source_job_id
  on mc_project_deliverables(source_job_id);
create index if not exists idx_mc_project_deliverables_status
  on mc_project_deliverables(status);

---------------------------------------------------------------------
-- 3. RLS
---------------------------------------------------------------------

alter table mc_project_deliverables enable row level security;

drop policy if exists "mc_project_deliverables_authed_select" on mc_project_deliverables;
create policy "mc_project_deliverables_authed_select"
  on mc_project_deliverables for select
  using (auth.role() = 'authenticated');

drop policy if exists "mc_project_deliverables_authed_mutate" on mc_project_deliverables;
create policy "mc_project_deliverables_authed_mutate"
  on mc_project_deliverables for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
