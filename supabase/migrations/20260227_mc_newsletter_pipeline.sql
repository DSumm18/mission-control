-- Newsletter pipeline: stage tracking, seed all 11 issues, update quality view

-- Add pipeline tracking columns to mc_newsletters
alter table mc_newsletters
  add column if not exists pipeline_status text not null default 'published'
    check (pipeline_status in ('research','draft','app_build','qa_review','approved','published'));
alter table mc_newsletters add column if not exists draft_version text;
alter table mc_newsletters add column if not exists snippet_url text;
alter table mc_newsletters add column if not exists tool_url text;
alter table mc_newsletters add column if not exists publish_date date;
alter table mc_newsletters add column if not exists updated_at timestamptz default now();

-- Seed all 11 newsletters (Week 6 already exists — upsert on url)
insert into mc_newsletters (title, week_no, issue_type, url, topic_category, tool_name, tool_decision, snippet_url, tool_url, draft_version, pipeline_status, publish_date, summary, notes)
values
  ('The Schoolgle Signal — Week 1', 1, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-01.html',
   'finance', 'NI Calculator', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-01-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/ni-calculator.html',
   'v4-final', 'published', '2026-01-06',
   'Employer NI hike impact on school budgets — what heads need to know',
   'Launch issue'),

  ('The Schoolgle Signal — Week 2', 2, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-02.html',
   'safeguarding', 'KCSIE Checker', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-02-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/kcsie-checker.html',
   'v4-final', 'published', '2026-01-13',
   'KCSIE 2025 changes — safeguarding compliance checker for DSLs',
   NULL),

  ('The Schoolgle Signal — Week 3', 3, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-03.html',
   'ofsted', 'Ofsted Explorer', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-03-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/ofsted-explorer.html',
   'v4-final', 'published', '2026-01-20',
   'Post-Ofsted reform — inspection data explorer for SLT preparation',
   NULL),

  ('The Schoolgle Signal — Week 4', 4, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-04.html',
   'estates', 'RAAC Checker', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-04-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/raac-checker.html',
   'v4-final', 'published', '2026-01-27',
   'RAAC and estates crisis — condition checker for school buildings',
   NULL),

  ('The Schoolgle Signal — Week 5', 5, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-05.html',
   'attendance', 'Attendance Dashboard', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-05-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/attendance-dashboard.html',
   'v4-final', 'published', '2026-02-03',
   'Persistent absence crisis — LA attendance benchmarking dashboard',
   NULL),

  ('The Schoolgle Signal — Week 6', 6, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-06.html',
   'finance', 'Budget Planner', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-06-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/budget-planner.html',
   'v4-final', 'published', '2026-02-10',
   'Spring budget planning — 3-year scenario modelling tool for SBMs',
   'Canonical finished article format'),

  ('The Schoolgle Signal — Week 7', 7, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-07.html',
   'governance', 'Governor Dashboard', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-07-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/governor-dashboard.html',
   'v4-final', 'published', '2026-02-17',
   'Governor effectiveness toolkit — meeting prep and compliance tracker',
   NULL),

  ('The Schoolgle Signal — Week 8', 8, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-08.html',
   'send', 'SEND Placement Explorer', 'reuse_existing',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-08-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/send-placement-explorer.html',
   'v4-final', 'published', '2026-02-24',
   'SEND placement crisis — LA comparison and tribunal data explorer',
   NULL),

  ('The Schoolgle Signal — Week 9', 9, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-09.html',
   'ai-policy', 'AI Policy Generator', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-09-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/ai-policy-generator.html',
   'v4-final', 'published', '2026-03-03',
   'AI in schools — policy generator aligned to DfE guidance',
   NULL),

  ('The Schoolgle Signal — Week 10', 10, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-10.html',
   'safeguarding', 'Safeguarding Audit', 'create_new',
   'https://dsumm18.github.io/schoolgle-tools/snippets/week-10-snippet.html',
   'https://dsumm18.github.io/schoolgle-tools/safeguarding-audit.html',
   'v4-final', 'published', '2026-03-10',
   'Annual safeguarding audit — self-assessment tool for DSLs and governors',
   NULL),

  ('The Schoolgle Signal — Week 11: EHCP Policy Paper', 11, 'newsletter',
   'https://dsumm18.github.io/schoolgle-tools/newsletters/week-11.html',
   'send', 'EHCP Readiness Snapshot', 'create_new',
   NULL,
   NULL,
   'v1-draft', 'draft', NULL,
   'EHCP reform readiness — policy paper with snapshot assessment tool',
   'Draft in progress — EHCP reform deep-dive')
on conflict (url) do update set
  title = excluded.title,
  week_no = excluded.week_no,
  issue_type = excluded.issue_type,
  topic_category = excluded.topic_category,
  tool_name = excluded.tool_name,
  tool_decision = excluded.tool_decision,
  snippet_url = excluded.snippet_url,
  tool_url = excluded.tool_url,
  draft_version = excluded.draft_version,
  pipeline_status = excluded.pipeline_status,
  publish_date = excluded.publish_date,
  summary = excluded.summary,
  notes = coalesce(excluded.notes, mc_newsletters.notes),
  updated_at = now();

-- Drop and recreate the quality view (column order changed)
drop view if exists mc_v_newsletter_quality;
create view mc_v_newsletter_quality as
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
  n.pipeline_status,
  n.draft_version,
  n.snippet_url,
  n.tool_url,
  n.publish_date,
  n.updated_at,
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
