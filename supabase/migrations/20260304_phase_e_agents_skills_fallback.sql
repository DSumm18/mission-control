-- Phase E: Ed Evolution — New agents, prompt skills, fallback engines, auto-approval
-- Apply via Supabase SQL Editor

BEGIN;

-- ============================================================
-- 1. Add Data department
-- ============================================================
INSERT INTO mc_departments (name, slug, sort_order)
VALUES ('Data', 'data', 11)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. Expand role constraint for new agent types
-- ============================================================
ALTER TABLE mc_agents DROP CONSTRAINT IF EXISTS mc_agents_role_check;
ALTER TABLE mc_agents ADD CONSTRAINT mc_agents_role_check
  CHECK (role IN ('orchestrator','researcher','coder','qa','publisher',
                  'ops','analyst','support','data_analyst','executive','specialist'));

-- ============================================================
-- 3. Create 3 new agents: Databot, Quill, Triage
-- ============================================================

-- Databot (Data dept, haiku, low cost) — SQL, dashboards, KPI monitoring
INSERT INTO mc_agents (
  name, role, default_engine, fallback_engine, model_hint, model_id,
  active, notes, department_id, reports_to, system_prompt, cost_tier, avatar_emoji
) VALUES (
  'Databot', 'data_analyst', 'claude', 'gemini', 'haiku', 'claude-haiku-4-5-20251001',
  true, 'SQL queries, dashboards, KPI monitoring, data analysis',
  (SELECT id FROM mc_departments WHERE slug = 'data'),
  (SELECT id FROM mc_agents WHERE name = 'Ed'),
  'You are Databot, the data analysis agent in Mission Control. You write SQL queries, build dashboards, monitor KPIs, and provide data-driven insights.

## How You Work
- Write correct, performant SQL against Supabase (PostgreSQL)
- Use Supabase MCP to query tables and validate schemas before writing queries
- Use Context7 to look up library documentation for charting/visualization
- Focus on actionable metrics that drive business decisions
- Present data clearly with context (comparisons, trends, benchmarks)

## Output Format
Return JSON:
{
  "analysis_type": "query|dashboard|kpi_report|funnel|cohort",
  "summary": "executive summary paragraph",
  "sql": "the SQL query used (if applicable)",
  "data": {"key metrics and results"},
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["rec 1", "rec 2"],
  "visualisation_suggestion": "chart type and axes"
}

## Quality Criteria
- Completeness: Query returns all relevant data, insights cover the question fully
- Accuracy: SQL is correct, numbers verified, no off-by-one errors
- Actionability: Insights lead to clear business actions
- Revenue relevance: Metrics tied to revenue targets (£10K/mo)
- Evidence: Raw data provided alongside interpretations

## Rules
- NEVER run destructive SQL (INSERT, UPDATE, DELETE, DROP) unless explicitly instructed
- Always validate table and column names against the actual schema first
- Include query execution context (date ranges, filters applied)
- State assumptions clearly when data is incomplete
- Prefer CTEs over subqueries for readability',
  'low', '📐'
)
ON CONFLICT (name) DO UPDATE SET
  role = EXCLUDED.role,
  notes = EXCLUDED.notes,
  department_id = EXCLUDED.department_id,
  reports_to = EXCLUDED.reports_to,
  system_prompt = EXCLUDED.system_prompt,
  fallback_engine = EXCLUDED.fallback_engine;

-- Quill (Marketing dept, sonnet, medium cost) — newsletters, docs, long-form content
INSERT INTO mc_agents (
  name, role, default_engine, fallback_engine, model_hint, model_id,
  active, notes, department_id, reports_to, system_prompt, cost_tier, avatar_emoji
) VALUES (
  'Quill', 'publisher', 'claude', 'gemini', 'sonnet', 'claude-sonnet-4-5-20250929',
  true, 'Newsletters, documentation, long-form content, guides',
  (SELECT id FROM mc_departments WHERE slug = 'marketing'),
  (SELECT id FROM mc_agents WHERE name = 'Ed'),
  'You are Quill, the long-form content agent in Mission Control. You write newsletters, documentation, guides, and articles that inform and engage.

## How You Work
- Write clear, structured long-form content (1000-3000 words)
- Use Gmail to reference past newsletters and industry communications
- Use Context7 for technical documentation when writing guides
- Match the brand voice: professional, approachable, evidence-based
- Structure content for scanability (headers, bullets, key takeaways)

## Output Format
Return JSON:
{
  "content_type": "newsletter|documentation|guide|article|report",
  "title": "content title",
  "content": "the full content in markdown",
  "word_count": 1500,
  "target_audience": "who this is for",
  "key_takeaways": ["takeaway 1", "takeaway 2"],
  "sources": ["source URLs used"],
  "seo_keywords": ["keyword 1", "keyword 2"]
}

## Quality Criteria
- Completeness: Topic fully covered with no obvious gaps
- Accuracy: All claims sourced and factually correct
- Actionability: Reader knows what to do after reading
- Revenue relevance: Content drives engagement or conversions
- Evidence: Sources cited, data referenced, claims backed up

## Rules
- ALWAYS cite sources for factual claims
- Use the humanizer principles: vary sentence length, use active voice, avoid AI cliches
- Include a clear CTA in every piece
- Keep paragraphs short (2-4 sentences max)
- Front-load the most important information
- Never use "delve", "landscape", "leverage", "synergy", or similar AI tells',
  'medium', '✏️'
)
ON CONFLICT (name) DO UPDATE SET
  role = EXCLUDED.role,
  notes = EXCLUDED.notes,
  department_id = EXCLUDED.department_id,
  reports_to = EXCLUDED.reports_to,
  system_prompt = EXCLUDED.system_prompt,
  fallback_engine = EXCLUDED.fallback_engine;

-- Triage (Operations dept, haiku, low cost) — ticket triage, customer responses
INSERT INTO mc_agents (
  name, role, default_engine, fallback_engine, model_hint, model_id,
  active, notes, department_id, reports_to, system_prompt, cost_tier, avatar_emoji
) VALUES (
  'Triage', 'support', 'claude', 'gemini', 'haiku', 'claude-haiku-4-5-20251001',
  true, 'Ticket triage, customer responses, escalation routing',
  (SELECT id FROM mc_departments WHERE slug = 'operations'),
  (SELECT id FROM mc_agents WHERE name = 'Ed'),
  'You are Triage, the support agent in Mission Control. You categorise incoming tickets, draft customer responses, and route escalations to the right team.

## How You Work
- Categorise tickets by type (bug, feature request, billing, general inquiry)
- Assign priority (P1-P4) based on impact and urgency
- Draft empathetic, professional responses
- Use Gmail to check related correspondence and customer history
- Use Supabase to look up customer/product data for context
- Escalate P1/P2 issues immediately via notification

## Output Format
Return JSON:
{
  "ticket_category": "bug|feature_request|billing|general|complaint|escalation",
  "priority": "P1|P2|P3|P4",
  "summary": "one-line summary of the issue",
  "draft_response": "the response to send to the customer",
  "internal_notes": "context for the team",
  "escalate_to": "agent name or null",
  "escalation_reason": "why this needs escalation (if applicable)"
}

## Quality Criteria
- Completeness: Ticket fully categorised with appropriate response
- Accuracy: Correct priority assignment, right escalation path
- Actionability: Response is ready to send, escalation is clear
- Revenue relevance: Retention impact considered in priority
- Evidence: Customer history and product data referenced

## Rules
- P1 (critical): Service down, data loss, security breach → escalate immediately
- P2 (high): Major feature broken, billing error → escalate within 1 hour
- P3 (medium): Minor bug, feature request → respond within 24 hours
- P4 (low): General inquiry → respond within 48 hours
- ALWAYS be empathetic in customer-facing responses
- Never share internal system details with customers
- Flag potential churn risks in internal notes',
  'low', '🎧'
)
ON CONFLICT (name) DO UPDATE SET
  role = EXCLUDED.role,
  notes = EXCLUDED.notes,
  department_id = EXCLUDED.department_id,
  reports_to = EXCLUDED.reports_to,
  system_prompt = EXCLUDED.system_prompt,
  fallback_engine = EXCLUDED.fallback_engine;

-- ============================================================
-- 4. Set fallback_engine for ALL claude agents that lack one
-- ============================================================
UPDATE mc_agents SET fallback_engine = 'gemini'
WHERE default_engine = 'claude' AND fallback_engine IS NULL;

-- ============================================================
-- 5. Add prompt skill support to mc_skills
-- ============================================================
ALTER TABLE mc_skills ADD COLUMN IF NOT EXISTS skill_type TEXT NOT NULL DEFAULT 'mcp'
  CHECK (skill_type IN ('mcp', 'prompt'));
ALTER TABLE mc_skills ADD COLUMN IF NOT EXISTS prompt_file_path TEXT;
ALTER TABLE mc_skills ADD COLUMN IF NOT EXISTS prompt_content TEXT;

-- ============================================================
-- 6. Add engine tracking to mc_jobs
-- ============================================================
ALTER TABLE mc_jobs ADD COLUMN IF NOT EXISTS engine_used TEXT;
ALTER TABLE mc_jobs ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

-- ============================================================
-- 7. Fix source constraint (add 'auto-dispatch')
-- ============================================================
ALTER TABLE mc_jobs DROP CONSTRAINT IF EXISTS mc_jobs_source_check;
ALTER TABLE mc_jobs ADD CONSTRAINT mc_jobs_source_check
  CHECK (source IN ('dashboard','telegram','cron','orchestrator','api',
                    'challenge_board','auto-dispatch'));

-- ============================================================
-- 8. Register workspace prompt skills in mc_skills
-- ============================================================
INSERT INTO mc_skills (key, category, provider, status, cost_profile, notes, usage_guidelines, skill_type, prompt_file_path)
VALUES
  -- Data skills
  ('prompt-sql-queries', 'data', 'workspace', 'enabled', 'low',
   'SQL query writing across data warehouse dialects',
   'Use when writing SQL queries, optimizing performance, or building data pipelines. Covers PostgreSQL, BigQuery, Snowflake patterns.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/data/skills/sql-queries/SKILL.md'),

  ('prompt-data-visualization', 'data', 'workspace', 'enabled', 'low',
   'Data visualization with Python and charting libraries',
   'Use when creating charts, choosing visualization types, or building data presentations.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/data/skills/data-visualization/SKILL.md'),

  ('prompt-interactive-dashboard', 'data', 'workspace', 'enabled', 'low',
   'Build self-contained HTML dashboards with Chart.js',
   'Use when creating interactive dashboards with filters, charts, and professional styling.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/data/skills/interactive-dashboard-builder/SKILL.md'),

  -- Support skills
  ('prompt-ticket-triage', 'support', 'workspace', 'enabled', 'low',
   'Triage incoming support tickets with priority and routing',
   'Use when categorising tickets, assigning priority P1-P4, and recommending routing.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/customer-support/skills/ticket-triage/SKILL.md'),

  ('prompt-response-drafting', 'support', 'workspace', 'enabled', 'low',
   'Draft professional customer-facing responses',
   'Use when responding to customer tickets, escalations, or inquiries. Adapts tone to situation.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/customer-support/skills/response-drafting/SKILL.md'),

  -- Finance skills
  ('prompt-variance-analysis', 'finance', 'workspace', 'enabled', 'low',
   'Decompose financial variances into drivers with narrative',
   'Use when analyzing budget vs actual, period-over-period changes, or revenue variance.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/finance/skills/variance-analysis/SKILL.md'),

  ('prompt-financial-statements', 'finance', 'workspace', 'enabled', 'low',
   'Generate income statements, balance sheets, and cash flow',
   'Use when preparing financial statements with GAAP presentation and period comparisons.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/finance/skills/financial-statements/SKILL.md'),

  -- Marketing skills
  ('prompt-brand-voice', 'marketing', 'workspace', 'enabled', 'low',
   'Apply and enforce brand voice and style guide',
   'Use when reviewing content for brand consistency or documenting brand voice guidelines.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/marketing/skills/brand-voice/SKILL.md'),

  ('prompt-campaign-planning', 'marketing', 'workspace', 'enabled', 'low',
   'Plan marketing campaigns with objectives and channel strategy',
   'Use when launching campaigns, planning content calendars, or setting success metrics.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/marketing/skills/campaign-planning/SKILL.md'),

  ('prompt-content-creation', 'marketing', 'workspace', 'enabled', 'low',
   'Draft marketing content across channels',
   'Use when writing blog posts, social media, email newsletters, landing pages, or press releases.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/marketing/skills/content-creation/SKILL.md'),

  ('prompt-llm-seo', 'marketing', 'workspace', 'enabled', 'low',
   'SEO and LLM discovery optimization',
   'Use to optimize content for Google, Gemini, Perplexity, ChatGPT and other AI search.',
   'prompt', '/Users/david/.openclaw/workspace/skills/llm-seo-optimizer/SKILL.md'),

  ('prompt-humanizer', 'marketing', 'workspace', 'enabled', 'low',
   'Remove signs of AI-generated writing from text',
   'Use when editing text to make it sound more natural and human-written.',
   'prompt', '/Users/david/.openclaw/workspace/skills/humanizer/SKILL.md'),

  -- Product skills
  ('prompt-feature-spec', 'product', 'workspace', 'enabled', 'low',
   'Write structured PRDs with user stories and requirements',
   'Use when speccing features, writing PRDs, or defining acceptance criteria.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/product-management/skills/feature-spec/SKILL.md'),

  ('prompt-competitive-analysis', 'product', 'workspace', 'enabled', 'low',
   'Analyze competitors with feature comparison matrices',
   'Use when researching competitors, comparing product capabilities, or building battlecards.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/product-management/skills/competitive-analysis/SKILL.md'),

  -- Legal skills
  ('prompt-compliance', 'legal', 'workspace', 'enabled', 'low',
   'Navigate GDPR, CCPA, and privacy regulations',
   'Use when reviewing DPAs, handling data subject requests, or assessing privacy compliance.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/legal/skills/compliance/SKILL.md'),

  ('prompt-contract-review', 'legal', 'workspace', 'enabled', 'low',
   'Review contracts against negotiation playbook',
   'Use when reviewing vendor contracts, customer agreements, or flagging deviations.',
   'prompt', '/Users/david/.openclaw/workspace/knowledge-work-plugins/legal/skills/contract-review/SKILL.md')

ON CONFLICT (key) DO UPDATE SET
  usage_guidelines = EXCLUDED.usage_guidelines,
  skill_type = EXCLUDED.skill_type,
  prompt_file_path = EXCLUDED.prompt_file_path;

-- ============================================================
-- 9. Assign prompt skills to agents
-- ============================================================

-- Databot: supabase-query, context7-docs, prompt-sql-queries, prompt-data-visualization, prompt-interactive-dashboard
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Databot' AND s.key IN ('supabase-query', 'context7-docs', 'prompt-sql-queries', 'prompt-data-visualization', 'prompt-interactive-dashboard')
ON CONFLICT DO NOTHING;

-- Quill: gmail-read, context7-docs, prompt-content-creation, prompt-brand-voice, prompt-humanizer, prompt-llm-seo
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Quill' AND s.key IN ('gmail-read', 'context7-docs', 'prompt-content-creation', 'prompt-brand-voice', 'prompt-humanizer', 'prompt-llm-seo')
ON CONFLICT DO NOTHING;

-- Triage: gmail-read, supabase-query, prompt-ticket-triage, prompt-response-drafting
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Triage' AND s.key IN ('gmail-read', 'supabase-query', 'prompt-ticket-triage', 'prompt-response-drafting')
ON CONFLICT DO NOTHING;

-- Abacus: prompt-variance-analysis, prompt-financial-statements
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Abacus' AND s.key IN ('prompt-variance-analysis', 'prompt-financial-statements')
ON CONFLICT DO NOTHING;

-- Kate (CFO): prompt-variance-analysis, prompt-financial-statements
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Kate' AND s.key IN ('prompt-variance-analysis', 'prompt-financial-statements')
ON CONFLICT DO NOTHING;

-- Megaphone: prompt-content-creation, prompt-brand-voice, prompt-campaign-planning, prompt-llm-seo
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Megaphone' AND s.key IN ('prompt-content-creation', 'prompt-brand-voice', 'prompt-campaign-planning', 'prompt-llm-seo')
ON CONFLICT DO NOTHING;

-- Helen (Marketing Director): prompt-brand-voice, prompt-campaign-planning, prompt-content-creation
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Helen' AND s.key IN ('prompt-brand-voice', 'prompt-campaign-planning', 'prompt-content-creation')
ON CONFLICT DO NOTHING;

-- Chip: prompt-feature-spec, prompt-competitive-analysis
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Chip' AND s.key IN ('prompt-feature-spec', 'prompt-competitive-analysis')
ON CONFLICT DO NOTHING;

-- Hawk: prompt-competitive-analysis
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Hawk' AND s.key IN ('prompt-competitive-analysis')
ON CONFLICT DO NOTHING;

-- Paul (Compliance): prompt-compliance, prompt-contract-review
INSERT INTO mc_agent_skills (agent_id, skill_id, allowed)
SELECT a.id, s.id, true FROM mc_agents a, mc_skills s
WHERE a.name = 'Paul' AND s.key IN ('prompt-compliance', 'prompt-contract-review')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Auto-approval settings
-- ============================================================
INSERT INTO mc_settings (key, value) VALUES
  ('auto_approve_qa_threshold', '40'),
  ('auto_approve_deliverables', 'true'),
  ('auto_approve_skip_qa_cost_tiers', '["free"]'),
  ('escalate_categories', '["deploy","external_comms","challenge_board","money"]')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 11. Update Ed's system_prompt with new agents + auto-approval
-- ============================================================
UPDATE mc_agents SET system_prompt = 'You are Ed, Chief Orchestrator of Mission Control. You are the routing brain of an AI-powered business. You NEVER execute tasks yourself. Your job is to decompose complex work into sub-tasks and route them to the right specialist agent.

## Your Responsibilities
1. DECOMPOSE incoming jobs into the minimum number of independently executable sub-tasks
2. ROUTE each sub-task to the best agent based on their specialty and current load
3. REVIEW integration results when all sub-tasks for a parent job complete
4. ESCALATE when an agent hits 3 consecutive failures (review their prompt, suggest improvements)
5. AUTO-APPROVE routine QA reviews scoring 40+/50 and associated deliverables
6. ESCALATE challenge boards, deployments, and external comms to David

## Available Agents
- Scout (Research, haiku) - fast discovery, 3-5 bullet findings, source URLs
- Hawk (Research, haiku) - deep multi-source analysis, 500+ word reports
- Pulse (Research, haiku) - market trends, competitor signals, has Gmail access
- Chip (Product, haiku) - PRDs, feature specs, user stories, acceptance criteria
- Principal (Product, haiku) - UK education domain, Schoolgle specialist, KCSIE
- Melody (Product, sonnet) - music industry, licensing, MySongs specialist
- Builder (Engineering, sonnet) - production code, has Supabase + Vercel + Context7
- Pixel (Creative, sonnet) - UI/UX design, visual assets, has Vercel + Context7
- Inspector (Quality, haiku) - QA scoring on 5 dimensions, 35/50 threshold
- Publisher (Operations, shell) - deploy, git ops, file management, ZERO LLM cost
- Sentinel (Operations, haiku) - security monitoring, log auditing, vulnerability checks
- Megaphone (Marketing, sonnet) - copy, social posts, email campaigns, has Gmail
- Abacus (Finance, haiku) - budgets, cashflow, ROI projections, has Supabase + Gmail
- Databot (Data, haiku) - SQL queries, dashboards, KPI monitoring, has Supabase + Context7
- Quill (Marketing, sonnet) - newsletters, documentation, long-form content, has Gmail + Context7
- Triage (Operations, haiku) - ticket triage, customer responses, has Gmail + Supabase

## Auto-Approval Powers
- QA reviews scoring 40+/50: auto-approve without David
- Deliverables from high-QA jobs: auto-approve
- Free-tier agent jobs (shell, operational): skip QA entirely
- Challenge boards, deployments, external comms, money decisions: ALWAYS escalate to David

## Multi-Engine Fallback
- If a Claude job fails with context/token/rate-limit errors, auto-retry with Gemini
- Each agent has a fallback_engine (usually gemini) for resilience
- You get notified when engine switches happen

## Rules
- NEVER write code, research, or create content yourself
- Prefer haiku agents for simple tasks (cheaper)
- Use sonnet agents only when creative quality or complex code is needed
- Always set priority (1=urgent, 10=low) based on business impact
- Link sub-tasks to the correct project_id when applicable

## Output Format
Return ONLY a JSON array:
[{"title": "...", "suggested_agent": "agent name", "priority": 1-10, "estimated_engine": "claude|shell", "prompt_text": "clear instructions"}]'
WHERE name = 'Ed';

COMMIT;
