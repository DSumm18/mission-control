-- Newsletter Automation: Research, Drafts, Sections, Pipeline Events
-- Phase 2 of newsletter automation pipeline

---------------------------------------------------------------------
-- 1. mc_research_items — the core research unit
---------------------------------------------------------------------
create table if not exists mc_research_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  source_url text unique,
  content_type text not null default 'article'
    check (content_type in ('youtube','article','govuk','pdf','social','manual')),
  title text,
  raw_content text,
  transcript_text text,

  summary text,
  key_points jsonb default '[]'::jsonb,
  why_relevant text,

  relevance_score int check (relevance_score between 1 and 10),
  newsletter_angle text,
  topic_area text,

  agent_assessment text,
  assessed_by uuid references mc_agents(id) on delete set null,
  assessed_at timestamptz,

  status text not null default 'captured'
    check (status in ('captured','assessing','assessed','approved','rejected','used')),
  approved_for_draft boolean not null default false,
  newsletter_id uuid references mc_newsletters(id) on delete set null,

  shared_by text not null default 'david',
  capture_job_id uuid references mc_jobs(id) on delete set null,
  assessment_job_id uuid references mc_jobs(id) on delete set null
);

create index if not exists idx_research_items_status on mc_research_items(status);
create index if not exists idx_research_items_newsletter on mc_research_items(newsletter_id);
create index if not exists idx_research_items_relevance on mc_research_items(relevance_score desc nulls last);

---------------------------------------------------------------------
-- 2. mc_newsletter_drafts — version-tracked drafts
---------------------------------------------------------------------
create table if not exists mc_newsletter_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  newsletter_id uuid not null references mc_newsletters(id) on delete cascade,
  version int not null default 1,

  full_markdown text,
  voice_check_score int check (voice_check_score between 1 and 10),
  voice_check_notes text,

  generated_by uuid references mc_agents(id) on delete set null,
  generation_job_id uuid references mc_jobs(id) on delete set null,

  status text not null default 'draft'
    check (status in ('draft','reviewing','approved','published')),
  david_notes text,

  unique(newsletter_id, version)
);

create index if not exists idx_drafts_newsletter on mc_newsletter_drafts(newsletter_id);

---------------------------------------------------------------------
-- 3. mc_newsletter_sections — maps to newsletter template structure
---------------------------------------------------------------------
create table if not exists mc_newsletter_sections (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references mc_newsletter_drafts(id) on delete cascade,
  section_key text not null
    check (section_key in (
      'headline','lead_story','data_snapshot','tool_spotlight',
      'policy_watch','quick_wins','week_ahead','snippet_preview'
    )),
  sort_order int not null default 0,
  title text,
  body_markdown text,
  research_item_ids uuid[] default '{}',
  written_by uuid references mc_agents(id) on delete set null
);

create index if not exists idx_sections_draft on mc_newsletter_sections(draft_id);

---------------------------------------------------------------------
-- 4. mc_pipeline_events — audit trail for stage transitions
---------------------------------------------------------------------
create table if not exists mc_pipeline_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  newsletter_id uuid not null references mc_newsletters(id) on delete cascade,
  from_stage text,
  to_stage text,
  triggered_by text,
  job_id uuid references mc_jobs(id) on delete set null,
  notes text
);

create index if not exists idx_pipeline_events_newsletter on mc_pipeline_events(newsletter_id);

---------------------------------------------------------------------
-- 5. Views
---------------------------------------------------------------------

-- Research feed: items + assessor name + newsletter week
drop view if exists mc_v_research_feed;
create view mc_v_research_feed as
select
  ri.id,
  ri.created_at,
  ri.updated_at,
  ri.source_url,
  ri.content_type,
  ri.title,
  ri.summary,
  ri.key_points,
  ri.why_relevant,
  ri.relevance_score,
  ri.newsletter_angle,
  ri.topic_area,
  ri.agent_assessment,
  ri.assessed_by,
  ri.assessed_at,
  ri.status,
  ri.approved_for_draft,
  ri.newsletter_id,
  ri.shared_by,
  ri.capture_job_id,
  ri.assessment_job_id,
  a.name as assessor_name,
  a.avatar_emoji as assessor_emoji,
  n.week_no as newsletter_week,
  n.title as newsletter_title
from mc_research_items ri
left join mc_agents a on a.id = ri.assessed_by
left join mc_newsletters n on n.id = ri.newsletter_id
order by ri.created_at desc;

-- Current pipeline: in-progress newsletters with research/draft/event counts
drop view if exists mc_v_current_pipeline;
create view mc_v_current_pipeline as
with research_counts as (
  select newsletter_id, count(*)::int as research_count,
         count(*) filter (where status = 'approved')::int as approved_count
  from mc_research_items
  where newsletter_id is not null
  group by newsletter_id
), draft_counts as (
  select newsletter_id, count(*)::int as draft_count,
         max(version) as latest_version
  from mc_newsletter_drafts
  group by newsletter_id
), event_counts as (
  select newsletter_id, count(*)::int as event_count
  from mc_pipeline_events
  group by newsletter_id
)
select
  n.id,
  n.title,
  n.week_no,
  n.pipeline_status,
  n.topic_category,
  n.draft_version,
  n.publish_date,
  n.updated_at,
  coalesce(rc.research_count, 0) as research_count,
  coalesce(rc.approved_count, 0) as approved_research,
  coalesce(dc.draft_count, 0) as draft_count,
  dc.latest_version,
  coalesce(ec.event_count, 0) as event_count
from mc_newsletters n
left join research_counts rc on rc.newsletter_id = n.id
left join draft_counts dc on dc.newsletter_id = n.id
left join event_counts ec on ec.newsletter_id = n.id
where n.pipeline_status not in ('published')
   or n.updated_at > now() - interval '14 days'
order by n.week_no desc nulls last;

---------------------------------------------------------------------
-- 6. RLS policies
---------------------------------------------------------------------

alter table mc_research_items enable row level security;
alter table mc_newsletter_drafts enable row level security;
alter table mc_newsletter_sections enable row level security;
alter table mc_pipeline_events enable row level security;

-- Service role has full access (used by API routes)
drop policy if exists "service_full_research_items" on mc_research_items;
create policy "service_full_research_items" on mc_research_items
  for all using (true) with check (true);

drop policy if exists "service_full_newsletter_drafts" on mc_newsletter_drafts;
create policy "service_full_newsletter_drafts" on mc_newsletter_drafts
  for all using (true) with check (true);

drop policy if exists "service_full_newsletter_sections" on mc_newsletter_sections;
create policy "service_full_newsletter_sections" on mc_newsletter_sections
  for all using (true) with check (true);

drop policy if exists "service_full_pipeline_events" on mc_pipeline_events;
create policy "service_full_pipeline_events" on mc_pipeline_events
  for all using (true) with check (true);

---------------------------------------------------------------------
-- 7. Updated_at trigger for research items
---------------------------------------------------------------------
create or replace function mc_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_research_items_updated on mc_research_items;
create trigger trg_research_items_updated
  before update on mc_research_items
  for each row execute function mc_set_updated_at();
