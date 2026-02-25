-- Newsletter QA v2: source transparency + tool viability governance

alter table mc_newsletters
  add column if not exists summary text,
  add column if not exists topic_category text,
  add column if not exists primary_theme text,
  add column if not exists tool_decision text check (tool_decision in ('create_new','adapt_existing','reuse_existing','no_tool')),
  add column if not exists tool_name text,
  add column if not exists tool_rationale text;

create table if not exists mc_signal_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique,
  source_type text not null check (source_type in ('official','regulator','news','social','community','internal')),
  domain text,
  check_cadence text not null default 'daily' check (check_cadence in ('hourly','daily','weekly','monthly')),
  reliability_score int not null default 7 check (reliability_score between 1 and 10),
  active boolean not null default true,
  notes text
);

create table if not exists mc_source_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_id uuid not null references mc_signal_sources(id) on delete cascade,
  topic_area text not null check (topic_area in ('finance','safeguarding','ofsted','estates','attendance','send','ai-policy','governance','other')),
  headline text not null,
  summary text,
  url text not null unique,
  published_at timestamptz,
  dataset_name text,
  verified_official boolean not null default false,
  potential_newsletter_angle text,
  impact_score int not null default 5 check (impact_score between 1 and 10)
);

create table if not exists mc_newsletter_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  newsletter_id uuid not null references mc_newsletters(id) on delete cascade,
  source_update_id uuid not null references mc_source_updates(id) on delete cascade,
  source_role text not null default 'supporting' check (source_role in ('primary','supporting','evidence')),
  unique(newsletter_id, source_update_id)
);

alter table mc_newsletter_reviews
  add column if not exists source_specificity_score int check (source_specificity_score between 1 and 10),
  add column if not exists source_transparency_score int check (source_transparency_score between 1 and 10),
  add column if not exists evidence_linking_score int check (evidence_linking_score between 1 and 10),
  add column if not exists tool_viability_score int check (tool_viability_score between 1 and 10),
  add column if not exists tool_qa_score int check (tool_qa_score between 1 and 10),
  add column if not exists compliance_confidence_score int check (compliance_confidence_score between 1 and 10),
  add column if not exists total_score_v2 int check (total_score_v2 between 12 and 120),
  add column if not exists tool_decision text check (tool_decision in ('create_new','adapt_existing','reuse_existing','no_tool')),
  add column if not exists tool_notes text;

create index if not exists idx_mc_source_updates_topic on mc_source_updates(topic_area, created_at desc);
create index if not exists idx_mc_newsletter_sources_newsletter on mc_newsletter_sources(newsletter_id);

alter table mc_signal_sources enable row level security;
alter table mc_source_updates enable row level security;
alter table mc_newsletter_sources enable row level security;

drop policy if exists "mc_signal_sources_authed_select" on mc_signal_sources;
create policy "mc_signal_sources_authed_select" on mc_signal_sources for select using (auth.role()='authenticated');
drop policy if exists "mc_signal_sources_authed_mutate" on mc_signal_sources;
create policy "mc_signal_sources_authed_mutate" on mc_signal_sources for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

drop policy if exists "mc_source_updates_authed_select" on mc_source_updates;
create policy "mc_source_updates_authed_select" on mc_source_updates for select using (auth.role()='authenticated');
drop policy if exists "mc_source_updates_authed_mutate" on mc_source_updates;
create policy "mc_source_updates_authed_mutate" on mc_source_updates for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

drop policy if exists "mc_newsletter_sources_authed_select" on mc_newsletter_sources;
create policy "mc_newsletter_sources_authed_select" on mc_newsletter_sources for select using (auth.role()='authenticated');
drop policy if exists "mc_newsletter_sources_authed_mutate" on mc_newsletter_sources;
create policy "mc_newsletter_sources_authed_mutate" on mc_newsletter_sources for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

insert into mc_signal_sources (name, source_type, domain, check_cadence, reliability_score, notes)
values
  ('Department for Education (DfE)', 'official', 'gov.uk', 'daily', 10, 'Primary policy/stat guidance source'),
  ('Education and Skills Funding Agency (ESFA)', 'official', 'gov.uk', 'daily', 10, 'Funding and financial updates'),
  ('Ofsted', 'regulator', 'ofsted.gov.uk', 'daily', 10, 'Inspection and framework updates'),
  ('Health and Safety Executive (HSE)', 'regulator', 'hse.gov.uk', 'weekly', 9, 'Estates and safety regulations'),
  ('GOV.UK Education Publications', 'official', 'gov.uk', 'daily', 10, 'Cross-cutting education publication feed'),
  ('LinkedIn Education Signals', 'social', 'linkedin.com', 'daily', 6, 'Early signal source; verify officially'),
  ('X/Twitter Education Signals', 'social', 'x.com', 'daily', 5, 'Early signal source; verify officially')
on conflict (name) do nothing;

create or replace view mc_v_newsletter_quality as
with latest_review as (
  select distinct on (r.newsletter_id)
    r.newsletter_id,
    r.id as review_id,
    r.created_at as reviewed_at,
    r.total_score,
    r.total_score_v2,
    r.ready_to_publish,
    r.value_for_money_score,
    r.school_relevance_score,
    r.actionability_score,
    r.clarity_score,
    r.differentiation_score,
    r.anti_ai_voice_score,
    r.source_specificity_score,
    r.source_transparency_score,
    r.evidence_linking_score,
    r.tool_viability_score,
    r.tool_qa_score,
    r.compliance_confidence_score,
    r.tool_decision as reviewed_tool_decision,
    r.reviewer
  from mc_newsletter_reviews r
  order by r.newsletter_id, r.created_at desc
), source_counts as (
  select newsletter_id, count(*)::int as source_updates_count
  from mc_newsletter_sources
  group by newsletter_id
)
select
  n.id,
  n.title,
  n.week_no,
  n.issue_type,
  n.url,
  n.notes,
  n.summary,
  n.topic_category,
  n.primary_theme,
  n.tool_decision,
  n.tool_name,
  n.tool_rationale,
  n.active,
  coalesce(sc.source_updates_count,0) as source_updates_count,
  lr.review_id,
  lr.reviewed_at,
  lr.total_score,
  lr.total_score_v2,
  lr.ready_to_publish,
  lr.value_for_money_score,
  lr.school_relevance_score,
  lr.actionability_score,
  lr.clarity_score,
  lr.differentiation_score,
  lr.anti_ai_voice_score,
  lr.source_specificity_score,
  lr.source_transparency_score,
  lr.evidence_linking_score,
  lr.tool_viability_score,
  lr.tool_qa_score,
  lr.compliance_confidence_score,
  lr.reviewed_tool_decision,
  lr.reviewer
from mc_newsletters n
left join latest_review lr on lr.newsletter_id = n.id
left join source_counts sc on sc.newsletter_id = n.id
order by n.issue_type, n.week_no nulls last, n.created_at desc;
