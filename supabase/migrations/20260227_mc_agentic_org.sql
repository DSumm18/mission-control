-- Mission Control: Agentic Organisation System
-- Departments, org chart, project management, QA reviews, prompt versioning

---------------------------------------------------------------------
-- 1. NEW TABLES
---------------------------------------------------------------------

-- Departments
create table if not exists mc_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Projects with delivery plans
create table if not exists mc_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  delivery_plan jsonb not null default '{}',
  pm_agent_id uuid references mc_agents(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','done')),
  revenue_target_monthly numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Job quality reviews (5-dimension rubric)
create table if not exists mc_job_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references mc_jobs(id) on delete cascade,
  reviewer_agent_id uuid references mc_agents(id) on delete set null,
  completeness int not null check (completeness between 1 and 10),
  accuracy int not null check (accuracy between 1 and 10),
  actionability int not null check (actionability between 1 and 10),
  revenue_relevance int not null check (revenue_relevance between 1 and 10),
  evidence int not null check (evidence between 1 and 10),
  total_score int generated always as (completeness + accuracy + actionability + revenue_relevance + evidence) stored,
  passed boolean not null default false,
  feedback text,
  created_at timestamptz not null default now()
);

-- Versioned agent prompts
create table if not exists mc_agent_prompts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references mc_agents(id) on delete cascade,
  version int not null,
  system_prompt text not null,
  performance_delta numeric,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(agent_id, version)
);

---------------------------------------------------------------------
-- 2. ALTER mc_agents — add org columns
---------------------------------------------------------------------

alter table mc_agents add column if not exists department_id uuid references mc_departments(id) on delete set null;
alter table mc_agents add column if not exists reports_to uuid references mc_agents(id) on delete set null;
alter table mc_agents add column if not exists system_prompt text;
alter table mc_agents add column if not exists quality_score_avg numeric(4,2) not null default 0;
alter table mc_agents add column if not exists total_jobs_completed int not null default 0;
alter table mc_agents add column if not exists consecutive_failures int not null default 0;
alter table mc_agents add column if not exists cost_tier text check (cost_tier in ('free','low','medium','high'));
alter table mc_agents add column if not exists avatar_emoji text;
alter table mc_agents add column if not exists model_id text;

---------------------------------------------------------------------
-- 3. ALTER mc_jobs — add routing + QA columns
---------------------------------------------------------------------

alter table mc_jobs add column if not exists agent_id uuid references mc_agents(id) on delete set null;
alter table mc_jobs add column if not exists parent_job_id uuid references mc_jobs(id) on delete set null;
alter table mc_jobs add column if not exists project_id uuid references mc_projects(id) on delete set null;
alter table mc_jobs add column if not exists quality_score int;
alter table mc_jobs add column if not exists review_notes text;
alter table mc_jobs add column if not exists priority int not null default 5;
alter table mc_jobs add column if not exists job_type text not null default 'task' check (job_type in ('task','decomposition','review','integration','pm'));
alter table mc_jobs add column if not exists source text not null default 'dashboard' check (source in ('dashboard','telegram','cron','orchestrator','api'));

-- Extend status to include new values (drop old, create new)
alter table mc_jobs drop constraint if exists mc_jobs_status_check;
alter table mc_jobs add constraint mc_jobs_status_check
  check (status in ('queued','running','paused_human','paused_quota','paused_proxy','done','failed','assigned','reviewing','rejected'));

---------------------------------------------------------------------
-- 4. ALTER mc_skills — add usage guidelines
---------------------------------------------------------------------

alter table mc_skills add column if not exists usage_guidelines text;
alter table mc_skills add column if not exists mcp_server_name text;
alter table mc_skills add column if not exists requires_api_key boolean not null default false;

---------------------------------------------------------------------
-- 5. INDEXES
---------------------------------------------------------------------

create index if not exists idx_mc_jobs_agent_id on mc_jobs(agent_id);
create index if not exists idx_mc_jobs_parent_job_id on mc_jobs(parent_job_id);
create index if not exists idx_mc_jobs_project_id on mc_jobs(project_id);
create index if not exists idx_mc_job_reviews_job_id on mc_job_reviews(job_id);
create index if not exists idx_mc_agent_prompts_agent_id on mc_agent_prompts(agent_id);
create index if not exists idx_mc_projects_status on mc_projects(status);

---------------------------------------------------------------------
-- 6. RLS
---------------------------------------------------------------------

alter table mc_departments enable row level security;
alter table mc_projects enable row level security;
alter table mc_job_reviews enable row level security;
alter table mc_agent_prompts enable row level security;

-- Use DROP + CREATE pattern (CREATE POLICY IF NOT EXISTS is invalid in Postgres)
drop policy if exists "mc_departments_authed_select" on mc_departments;
create policy "mc_departments_authed_select" on mc_departments for select using (auth.role() = 'authenticated');
drop policy if exists "mc_departments_authed_mutate" on mc_departments;
create policy "mc_departments_authed_mutate" on mc_departments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "mc_projects_authed_select" on mc_projects;
create policy "mc_projects_authed_select" on mc_projects for select using (auth.role() = 'authenticated');
drop policy if exists "mc_projects_authed_mutate" on mc_projects;
create policy "mc_projects_authed_mutate" on mc_projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "mc_job_reviews_authed_select" on mc_job_reviews;
create policy "mc_job_reviews_authed_select" on mc_job_reviews for select using (auth.role() = 'authenticated');
drop policy if exists "mc_job_reviews_authed_mutate" on mc_job_reviews;
create policy "mc_job_reviews_authed_mutate" on mc_job_reviews for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "mc_agent_prompts_authed_select" on mc_agent_prompts;
create policy "mc_agent_prompts_authed_select" on mc_agent_prompts for select using (auth.role() = 'authenticated');
drop policy if exists "mc_agent_prompts_authed_mutate" on mc_agent_prompts;
create policy "mc_agent_prompts_authed_mutate" on mc_agent_prompts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

---------------------------------------------------------------------
-- 7. VIEWS
---------------------------------------------------------------------

create or replace view mc_v_org_chart as
select
  a.id as agent_id,
  a.name as agent_name,
  a.role,
  a.default_engine,
  a.model_id,
  a.model_hint,
  a.cost_tier,
  a.avatar_emoji,
  a.active,
  a.quality_score_avg,
  a.total_jobs_completed,
  a.consecutive_failures,
  a.system_prompt,
  d.id as department_id,
  d.name as department_name,
  d.slug as department_slug,
  d.sort_order as department_sort,
  mgr.id as reports_to_id,
  mgr.name as reports_to_name
from mc_agents a
left join mc_departments d on d.id = a.department_id
left join mc_agents mgr on mgr.id = a.reports_to
order by d.sort_order, a.name;

create or replace view mc_v_agent_performance as
select
  a.id as agent_id,
  a.name as agent_name,
  a.quality_score_avg,
  a.total_jobs_completed,
  a.consecutive_failures,
  a.cost_tier,
  count(j.id) filter (where j.created_at >= now() - interval '7 days') as jobs_7d,
  count(j.id) filter (where j.status = 'done' and j.created_at >= now() - interval '7 days') as jobs_done_7d,
  count(j.id) filter (where j.status = 'failed' and j.created_at >= now() - interval '7 days') as jobs_failed_7d,
  avg(j.quality_score) filter (where j.quality_score is not null and j.created_at >= now() - interval '7 days') as avg_quality_7d
from mc_agents a
left join mc_jobs j on j.agent_id = a.id
group by a.id, a.name, a.quality_score_avg, a.total_jobs_completed, a.consecutive_failures, a.cost_tier;

create or replace view mc_v_job_pipeline as
select
  j.id as job_id,
  j.title,
  j.status,
  j.engine,
  j.priority,
  j.job_type,
  j.source,
  j.quality_score,
  j.review_notes,
  j.parent_job_id,
  j.created_at,
  j.started_at,
  j.completed_at,
  a.id as agent_id,
  a.name as agent_name,
  a.avatar_emoji as agent_emoji,
  d.name as department_name,
  p.id as project_id,
  p.name as project_name,
  p.slug as project_slug
from mc_jobs j
left join mc_agents a on a.id = j.agent_id
left join mc_departments d on d.id = a.department_id
left join mc_projects p on p.id = j.project_id
order by j.priority asc, j.created_at desc;

---------------------------------------------------------------------
-- 8. SEED DATA — Departments
---------------------------------------------------------------------

insert into mc_departments (name, slug, sort_order) values
  ('Executive',   'executive',   1),
  ('Product',     'product',     2),
  ('Research',    'research',    3),
  ('Engineering', 'engineering', 4),
  ('Quality',     'quality',     5),
  ('Operations',  'operations',  6),
  ('Marketing',   'marketing',   7)
on conflict (slug) do nothing;

---------------------------------------------------------------------
-- 9. SEED DATA — New Agents + Update Existing
---------------------------------------------------------------------

-- Update existing Orchestrator -> Ed
update mc_agents set
  name = 'Ed',
  role = 'orchestrator',
  default_engine = 'claude',
  fallback_engine = null,
  model_hint = 'claude-haiku-4-5-20251001',
  model_id = 'claude-haiku-4-5-20251001',
  cost_tier = 'low',
  avatar_emoji = '🎯',
  notes = 'Chief Orchestrator — decomposes, routes, reviews, rejects. NEVER completes tasks himself.',
  department_id = (select id from mc_departments where slug = 'executive'),
  reports_to = null,
  system_prompt = 'You are Ed, the Chief Orchestrator of Mission Control. Your ONLY job is to decompose work into sub-tasks, route them to the right agent, review completed work against quality rubrics, and push back if quality fails. You NEVER write code, do research, or create content yourself. You delegate EVERYTHING.'
where name = 'Orchestrator';

-- Update existing Researcher -> Scout
update mc_agents set
  name = 'Scout',
  role = 'researcher',
  default_engine = 'claude',
  fallback_engine = null,
  model_hint = 'claude-haiku-4-5-20251001',
  model_id = 'claude-haiku-4-5-20251001',
  cost_tier = 'low',
  avatar_emoji = '🔍',
  notes = 'Fast discovery and evidence collection — first pass research',
  department_id = (select id from mc_departments where slug = 'research'),
  reports_to = (select id from mc_agents where name = 'Ed'),
  system_prompt = 'You are Scout, a research agent. You perform fast discovery and evidence collection. Find facts, verify claims, gather data, and return structured findings with sources.'
where name = 'Researcher';

-- Update existing Verifier -> Inspector
update mc_agents set
  name = 'Inspector',
  role = 'qa',
  default_engine = 'claude',
  fallback_engine = null,
  model_hint = 'claude-haiku-4-5-20251001',
  model_id = 'claude-haiku-4-5-20251001',
  cost_tier = 'low',
  avatar_emoji = '🔎',
  notes = 'Quality assurance — scores outputs on 5-dimension rubric',
  department_id = (select id from mc_departments where slug = 'quality'),
  reports_to = (select id from mc_agents where name = 'Ed'),
  system_prompt = 'You are Inspector, the quality assurance agent. You review job outputs and score them on 5 dimensions (1-10 each): completeness, accuracy, actionability, revenue_relevance, evidence. Return a JSON object with these scores plus a feedback string explaining your assessment.'
where name = 'Verifier';

-- Update existing Builder
update mc_agents set
  default_engine = 'claude',
  fallback_engine = null,
  model_hint = 'claude-sonnet-4-5-20250929',
  model_id = 'claude-sonnet-4-5-20250929',
  cost_tier = 'medium',
  avatar_emoji = '🔨',
  notes = 'Code implementation — builds features, fixes bugs, writes tests',
  department_id = (select id from mc_departments where slug = 'engineering'),
  reports_to = (select id from mc_agents where name = 'Ed'),
  system_prompt = 'You are Builder, the engineering agent. You write clean, tested, production-ready code. Follow existing patterns in the codebase. Keep changes minimal and focused.'
where name = 'Builder';

-- Update existing Publisher
update mc_agents set
  default_engine = 'shell',
  fallback_engine = null,
  model_hint = null,
  model_id = null,
  cost_tier = 'free',
  avatar_emoji = '🚀',
  notes = 'Deploy commands, git ops, release steps — zero LLM cost',
  department_id = (select id from mc_departments where slug = 'operations'),
  reports_to = (select id from mc_agents where name = 'Ed'),
  system_prompt = null
where name = 'Publisher';

-- Insert new agents (skip if already exists)
insert into mc_agents (name, role, default_engine, model_hint, model_id, cost_tier, avatar_emoji, notes, department_id, reports_to, system_prompt, active)
values
  ('Chip', 'researcher', 'claude', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001', 'low', '💡',
   'Product specs, feature design, user stories',
   (select id from mc_departments where slug = 'product'),
   (select id from mc_agents where name = 'Ed'),
   'You are Chip, a product agent. You write product specs, feature designs, and user stories. Focus on clear requirements, acceptance criteria, and user value.',
   true),

  ('Pixel', 'coder', 'claude', 'claude-sonnet-4-5-20250929', 'claude-sonnet-4-5-20250929', 'medium', '🎨',
   'Creative and design — UI/UX, visual assets, branding',
   (select id from mc_departments where slug = 'product'),
   (select id from mc_agents where name = 'Ed'),
   'You are Pixel, a creative agent. You handle UI/UX design, visual assets, and branding work. Focus on clean, modern designs that match the product aesthetic.',
   true),

  ('Principal', 'researcher', 'claude', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001', 'low', '🏫',
   'Schools domain expert — Schoolgle product specialist',
   (select id from mc_departments where slug = 'product'),
   (select id from mc_agents where name = 'Ed'),
   'You are Principal, the schools domain expert. You specialise in education technology, school management, and the Schoolgle product. You understand UK school systems, OFSTED, and edtech requirements.',
   true),

  ('Melody', 'coder', 'claude', 'claude-sonnet-4-5-20250929', 'claude-sonnet-4-5-20250929', 'medium', '🎵',
   'Music domain expert — MySongs product specialist',
   (select id from mc_departments where slug = 'product'),
   (select id from mc_agents where name = 'Ed'),
   'You are Melody, the music domain expert. You specialise in music technology, audio processing, and the MySongs product. You understand music licensing, audio formats, and music app UX.',
   true),

  ('Hawk', 'researcher', 'claude', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001', 'low', '🦅',
   'Deep research — competitor analysis, market intelligence',
   (select id from mc_departments where slug = 'research'),
   (select id from mc_agents where name = 'Ed'),
   'You are Hawk, a deep research agent. You perform competitor analysis, market intelligence, and strategic research. Go deep on topics and return comprehensive, evidence-backed findings.',
   true),

  ('Pulse', 'researcher', 'claude', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001', 'low', '📊',
   'Trend monitoring — social signals, market movements',
   (select id from mc_departments where slug = 'research'),
   (select id from mc_agents where name = 'Ed'),
   'You are Pulse, a trend monitoring agent. You track social signals, market movements, and emerging opportunities. Deliver concise trend reports with actionable insights.',
   true),

  ('Radar', 'researcher', 'claude', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001', 'low', '📡',
   'Technology radar — new tools, APIs, frameworks',
   (select id from mc_departments where slug = 'research'),
   (select id from mc_agents where name = 'Ed'),
   'You are Radar, a technology radar agent. You scan for new tools, APIs, frameworks, and technical opportunities. Evaluate tech for practical applicability to our product portfolio.',
   true),

  ('Sentinel', 'ops', 'claude', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001', 'low', '🛡️',
   'Security and monitoring — uptime, health checks, alerts',
   (select id from mc_departments where slug = 'operations'),
   (select id from mc_agents where name = 'Ed'),
   'You are Sentinel, the security and monitoring agent. You run health checks, monitor uptime, scan for vulnerabilities, and raise alerts. Focus on operational reliability.',
   true),

  ('Megaphone', 'publisher', 'claude', 'claude-sonnet-4-5-20250929', 'claude-sonnet-4-5-20250929', 'medium', '📣',
   'Marketing copy — social posts, newsletters, landing pages',
   (select id from mc_departments where slug = 'marketing'),
   (select id from mc_agents where name = 'Ed'),
   'You are Megaphone, the marketing agent. You write social media posts, newsletter copy, landing page content, and marketing campaigns. Write compelling, concise copy that drives engagement and conversions.',
   true)
on conflict (name) do nothing;

---------------------------------------------------------------------
-- 10. SEED DATA — Projects
---------------------------------------------------------------------

insert into mc_projects (name, slug, description, status, revenue_target_monthly, pm_agent_id, delivery_plan) values
  ('MySongs', 'mysongs', 'AI-powered music creation and distribution platform', 'active', 2000.00,
   (select id from mc_agents where name = 'Melody'),
   '{"milestones": [{"name": "MVP Launch", "target": "2026-03-15", "status": "in_progress"}, {"name": "Payment Integration", "target": "2026-03-31", "status": "pending"}]}'),

  ('MyMeme', 'mymeme', 'AI meme generator with viral distribution', 'active', 1500.00,
   (select id from mc_agents where name = 'Pixel'),
   '{"milestones": [{"name": "Template Engine", "target": "2026-03-10", "status": "in_progress"}, {"name": "Social Sharing", "target": "2026-03-20", "status": "pending"}]}'),

  ('Schoolgle', 'schoolgle', 'School management and communication platform', 'active', 3000.00,
   (select id from mc_agents where name = 'Principal'),
   '{"milestones": [{"name": "Parent Portal", "target": "2026-03-15", "status": "pending"}, {"name": "OFSTED Dashboard", "target": "2026-03-31", "status": "pending"}]}'),

  ('DealFind', 'dealfind', 'AI-powered deal discovery and comparison', 'active', 2000.00,
   (select id from mc_agents where name = 'Chip'),
   '{"milestones": [{"name": "Price Scraping v2", "target": "2026-03-10", "status": "in_progress"}, {"name": "Alert System", "target": "2026-03-25", "status": "pending"}]}'),

  ('ClawPhone', 'clawphone', 'Custom Android launcher with AI integration', 'active', 1000.00,
   (select id from mc_agents where name = 'Chip'),
   '{"milestones": [{"name": "Launcher MVP", "target": "2026-04-01", "status": "pending"}]}'),

  ('CricBook', 'cricbook', 'Cricket stats and social platform', 'active', 500.00,
   (select id from mc_agents where name = 'Chip'),
   '{"milestones": [{"name": "Live Scores API", "target": "2026-03-20", "status": "pending"}, {"name": "Social Feed", "target": "2026-04-01", "status": "pending"}]}')
on conflict (slug) do nothing;

---------------------------------------------------------------------
-- 11. SEED DATA — Settings
---------------------------------------------------------------------

insert into mc_settings (key, value, updated_at) values
  ('qa_pass_threshold', '35', now()),
  ('max_consecutive_failures', '3', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

---------------------------------------------------------------------
-- 12. SEED DATA — Skill usage guidelines
---------------------------------------------------------------------

update mc_skills set
  usage_guidelines = 'Delegates coding tasks to Claude Code agent via Anti-Gravity proxy. Use for any code changes, bug fixes, feature implementation, or test writing.',
  mcp_server_name = 'coding-agent',
  requires_api_key = false
where key = 'coding-agent';

update mc_skills set
  usage_guidelines = 'Fast research and synthesis via Google Gemini. Use for web research, document summarisation, and general knowledge queries.',
  mcp_server_name = 'gemini',
  requires_api_key = true
where key = 'gemini';

update mc_skills set
  usage_guidelines = 'GitHub PR, issues, and actions workflows. Use for code review, PR creation, issue management, and CI/CD operations.',
  mcp_server_name = 'github',
  requires_api_key = true
where key = 'github';

update mc_skills set
  usage_guidelines = 'Advanced GitHub issue triage and implementation loops. Use for complex multi-step issue resolution.',
  mcp_server_name = 'gh-issues',
  requires_api_key = true
where key = 'gh-issues';

update mc_skills set
  usage_guidelines = 'Image and video generation via Runware API. Use for creating visual assets, thumbnails, social media images.',
  mcp_server_name = 'runware',
  requires_api_key = true
where key = 'runware';

update mc_skills set
  usage_guidelines = 'Video generation via Google Veo. Use for creating short video content.',
  mcp_server_name = 'veo',
  requires_api_key = true
where key = 'veo';

update mc_skills set
  usage_guidelines = 'Frame extraction from videos using ffmpeg. Use for video processing, thumbnail generation, video analysis.',
  mcp_server_name = null,
  requires_api_key = false
where key = 'video-frames';

update mc_skills set
  usage_guidelines = 'Publishing content to X (Twitter). Use for social media distribution and engagement.',
  mcp_server_name = 'x-api',
  requires_api_key = true
where key = 'x-api';

update mc_skills set
  usage_guidelines = 'Cookie-based X workflows for extended publishing capabilities.',
  mcp_server_name = 'bird',
  requires_api_key = false
where key = 'bird';

update mc_skills set
  usage_guidelines = 'Host hardening and posture checks. Use for security audits, uptime monitoring, and infrastructure health.',
  mcp_server_name = 'healthcheck',
  requires_api_key = false
where key = 'healthcheck';
