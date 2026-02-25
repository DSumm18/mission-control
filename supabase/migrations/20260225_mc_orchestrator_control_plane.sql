-- Mission Control: Orchestrator control plane
-- Adds agents, skills, bindings, run ledger, and operational views

create table if not exists mc_agents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique,
  role text not null check (role in ('orchestrator','researcher','coder','qa','publisher','ops')),
  default_engine text not null check (default_engine in ('claude','gemini','openai','shell')),
  fallback_engine text check (fallback_engine in ('claude','gemini','openai','shell')),
  model_hint text,
  active boolean not null default true,
  notes text
);

create table if not exists mc_skills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  key text not null unique,
  category text,
  provider text,
  status text not null default 'enabled' check (status in ('enabled','disabled','pilot')),
  cost_profile text,
  notes text
);

create table if not exists mc_agent_skills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_id uuid not null references mc_agents(id) on delete cascade,
  skill_id uuid not null references mc_skills(id) on delete cascade,
  allowed boolean not null default true,
  usage_limit_daily int,
  unique(agent_id, skill_id)
);

create table if not exists mc_job_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid references mc_jobs(id) on delete set null,
  agent_id uuid references mc_agents(id) on delete set null,
  engine text not null check (engine in ('claude','gemini','openai','shell')),
  model_used text,
  status text not null check (status in ('queued','running','paused_human','paused_quota','paused_proxy','done','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms int,
  tokens_in int,
  tokens_out int,
  estimated_cost_usd numeric(12,6),
  evidence_log_path text,
  error_summary text,
  payload jsonb
);

create index if not exists idx_mc_jobs_status_created_at on mc_jobs(status, created_at desc);
create index if not exists idx_mc_job_runs_created_at on mc_job_runs(created_at desc);
create index if not exists idx_mc_job_runs_status_created_at on mc_job_runs(status, created_at desc);
create index if not exists idx_mc_job_runs_engine_created_at on mc_job_runs(engine, created_at desc);

alter table mc_agents enable row level security;
alter table mc_skills enable row level security;
alter table mc_agent_skills enable row level security;
alter table mc_job_runs enable row level security;

create policy if not exists "mc_agents_authed_select" on mc_agents for select using (auth.role() = 'authenticated');
create policy if not exists "mc_agents_authed_mutate" on mc_agents for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy if not exists "mc_skills_authed_select" on mc_skills for select using (auth.role() = 'authenticated');
create policy if not exists "mc_skills_authed_mutate" on mc_skills for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy if not exists "mc_agent_skills_authed_select" on mc_agent_skills for select using (auth.role() = 'authenticated');
create policy if not exists "mc_agent_skills_authed_mutate" on mc_agent_skills for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy if not exists "mc_job_runs_authed_select" on mc_job_runs for select using (auth.role() = 'authenticated');
create policy if not exists "mc_job_runs_authed_mutate" on mc_job_runs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into mc_agents (name, role, default_engine, fallback_engine, model_hint, notes)
values
  ('Orchestrator', 'orchestrator', 'openai', 'claude', 'gpt-5.3-codex', 'Decompose, assign, QA gate, merge decisions'),
  ('Researcher', 'researcher', 'gemini', 'openai', 'gemini-3-flash', 'Fast discovery and evidence collection'),
  ('Builder', 'coder', 'claude', 'openai', 'claude-code via Anti-Gravity', 'Code implementation worker'),
  ('Verifier', 'qa', 'claude', 'openai', 'claude-code / codex', 'Independent acceptance testing'),
  ('Publisher', 'publisher', 'shell', 'openai', 'shell + channel tools', 'Release + messaging + rollout steps')
on conflict (name) do nothing;

insert into mc_skills (key, category, provider, status, cost_profile, notes)
values
  ('coding-agent', 'delivery', 'openclaw', 'enabled', 'medium', 'Delegates coding to external coding agents'),
  ('gemini', 'research', 'google', 'enabled', 'low', 'Fast research/synthesis'),
  ('github', 'delivery', 'github', 'enabled', 'low', 'PR/issues/actions workflows'),
  ('gh-issues', 'delivery', 'github', 'pilot', 'medium', 'Issue triage + implementation loops'),
  ('runware', 'creative', 'runware', 'enabled', 'variable', 'Image/video generation'),
  ('veo', 'creative', 'google', 'pilot', 'high', 'Video generation'),
  ('video-frames', 'media', 'ffmpeg', 'enabled', 'low', 'Frame extraction'),
  ('x-api', 'distribution', 'x', 'enabled', 'low', 'Publishing to X'),
  ('bird', 'distribution', 'x', 'pilot', 'low', 'Cookie-based X workflows'),
  ('healthcheck', 'ops', 'openclaw', 'enabled', 'low', 'Host hardening and posture checks')
on conflict (key) do nothing;

insert into mc_agent_skills (agent_id, skill_id, allowed)
select a.id, s.id, true
from mc_agents a
join mc_skills s on (
  (a.role = 'researcher' and s.key in ('gemini','github')) or
  (a.role = 'coder' and s.key in ('coding-agent','github','gh-issues')) or
  (a.role = 'qa' and s.key in ('coding-agent','github','healthcheck')) or
  (a.role = 'publisher' and s.key in ('x-api','bird','video-frames','runware','veo')) or
  (a.role = 'orchestrator' and s.key in ('gemini','coding-agent','github','gh-issues','x-api','healthcheck'))
)
on conflict (agent_id, skill_id) do nothing;

create or replace view mc_v_runs_recent as
select
  r.id,
  r.created_at,
  r.job_id,
  a.name as agent_name,
  a.role as agent_role,
  r.engine,
  r.model_used,
  r.status,
  r.duration_ms,
  r.tokens_in,
  r.tokens_out,
  r.estimated_cost_usd,
  r.error_summary
from mc_job_runs r
left join mc_agents a on a.id = r.agent_id
order by r.created_at desc;

create or replace view mc_v_cost_by_engine_7d as
select
  engine,
  count(*) as runs,
  coalesce(sum(estimated_cost_usd),0)::numeric(12,6) as est_cost_usd,
  round((avg(duration_ms)::numeric),2) as avg_duration_ms
from mc_job_runs
where created_at >= now() - interval '7 days'
group by engine
order by est_cost_usd desc;
