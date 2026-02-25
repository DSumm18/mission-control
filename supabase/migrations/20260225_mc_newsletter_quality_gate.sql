-- Mission Control: Newsletter quality gate

create table if not exists mc_newsletters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  week_no int,
  issue_type text not null default 'newsletter' check (issue_type in ('newsletter','tool','resource')),
  url text not null unique,
  notes text,
  active boolean not null default true
);

create table if not exists mc_newsletter_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  newsletter_id uuid not null references mc_newsletters(id) on delete cascade,
  reviewer text not null default 'Ed',
  value_for_money_score int not null check (value_for_money_score between 1 and 10),
  school_relevance_score int not null check (school_relevance_score between 1 and 10),
  actionability_score int not null check (actionability_score between 1 and 10),
  clarity_score int not null check (clarity_score between 1 and 10),
  differentiation_score int not null check (differentiation_score between 1 and 10),
  anti_ai_voice_score int not null check (anti_ai_voice_score between 1 and 10),
  total_score int not null check (total_score between 6 and 60),
  ready_to_publish boolean not null default false,
  strengths text,
  gaps text,
  recommendations text
);

create index if not exists idx_mc_newsletters_active on mc_newsletters(active, created_at desc);
create index if not exists idx_mc_newsletter_reviews_newsletter on mc_newsletter_reviews(newsletter_id, created_at desc);

alter table mc_newsletters enable row level security;
alter table mc_newsletter_reviews enable row level security;

drop policy if exists "mc_newsletters_authed_select" on mc_newsletters;
create policy "mc_newsletters_authed_select" on mc_newsletters
for select using (auth.role() = 'authenticated');

drop policy if exists "mc_newsletters_authed_mutate" on mc_newsletters;
create policy "mc_newsletters_authed_mutate" on mc_newsletters
for all using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "mc_newsletter_reviews_authed_select" on mc_newsletter_reviews;
create policy "mc_newsletter_reviews_authed_select" on mc_newsletter_reviews
for select using (auth.role() = 'authenticated');

drop policy if exists "mc_newsletter_reviews_authed_mutate" on mc_newsletter_reviews;
create policy "mc_newsletter_reviews_authed_mutate" on mc_newsletter_reviews
for all using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

insert into mc_newsletters (title, week_no, issue_type, url, notes)
values
  ('The Schoolgle Signal — Week 6', 6, 'newsletter', 'https://dsumm18.github.io/schoolgle-tools/newsletters/week-06.html', 'Canonical finished article format'),
  ('NI Calculator', null, 'tool', 'https://dsumm18.github.io/schoolgle-tools/ni-calculator.html', 'Finance impact utility'),
  ('KCSIE Checker', null, 'tool', 'https://dsumm18.github.io/schoolgle-tools/kcsie-checker.html', 'Safeguarding compliance checker'),
  ('Ofsted Explorer', null, 'tool', 'https://dsumm18.github.io/schoolgle-tools/ofsted-explorer.html', 'Inspection intelligence tool'),
  ('SEND Placement Explorer', null, 'tool', 'https://dsumm18.github.io/schoolgle-tools/send-placement-explorer.html', 'SEND planning/benchmark utility')
on conflict (url) do nothing;

create or replace view mc_v_newsletter_quality as
with latest_review as (
  select distinct on (r.newsletter_id)
    r.newsletter_id,
    r.id as review_id,
    r.created_at as reviewed_at,
    r.total_score,
    r.ready_to_publish,
    r.value_for_money_score,
    r.school_relevance_score,
    r.actionability_score,
    r.clarity_score,
    r.differentiation_score,
    r.anti_ai_voice_score,
    r.reviewer
  from mc_newsletter_reviews r
  order by r.newsletter_id, r.created_at desc
)
select
  n.id,
  n.title,
  n.week_no,
  n.issue_type,
  n.url,
  n.notes,
  n.active,
  lr.review_id,
  lr.reviewed_at,
  lr.total_score,
  lr.ready_to_publish,
  lr.value_for_money_score,
  lr.school_relevance_score,
  lr.actionability_score,
  lr.clarity_score,
  lr.differentiation_score,
  lr.anti_ai_voice_score,
  lr.reviewer
from mc_newsletters n
left join latest_review lr on lr.newsletter_id = n.id
order by n.issue_type, n.week_no nulls last, n.created_at desc;
