# Agent Performance Framework & Product PM Role Definitions

**Owner:** Jen (HR Director) | **Effective:** 1 March 2026
**Review Cycle:** Monthly | **Next Review:** 1 April 2026
**Approved by:** David (Founder) via Ed (Chief Orchestrator)

---

## Table of Contents

1. [Agent Performance Metrics](#1-agent-performance-metrics)
2. [Scoring Thresholds & Consequences](#2-scoring-thresholds--consequences)
3. [Monthly Performance Review Process](#3-monthly-performance-review-process)
4. [Product PM Role Definitions](#4-product-pm-role-definitions)
5. [PM Escalation Protocol](#5-pm-escalation-protocol)
6. [Monthly Review Template](#6-monthly-review-template)

---

## 1. Agent Performance Metrics

Every agent in Mission Control is measured on **four pillars**. Metrics are computed from live data in the `mc_job_runs`, `mc_job_reviews`, and `mc_jobs` tables.

### 1.1 Task Completion Rate (TCR)

| What it measures | Formula | Data source |
|---|---|---|
| Percentage of assigned jobs finished successfully | `(jobs status='done') / (total assigned jobs) × 100` | `mc_jobs` filtered by `agent_id` |

**Targets:**

| Rating | TCR |
|---|---|
| Excellent | ≥ 95% |
| Good | 85–94% |
| Needs improvement | 70–84% |
| Failing | < 70% |

**Notes:**
- Jobs in `paused_human` or `paused_quota` status are excluded from the denominator — those are system-blocked, not agent failures.
- Jobs in `rejected` status count as failures.

### 1.2 QA Pass Rate (QPR)

| What it measures | Formula | Data source |
|---|---|---|
| Percentage of completed jobs that pass Inspector's 5-dimension quality rubric | `(reviews where total_score ≥ 35 AND passed=true) / (total reviews) × 100` | `mc_job_reviews` |

**The 5-Dimension Quality Rubric (Inspector's Scorecard):**

| Dimension | Score Range | What Inspector Checks |
|---|---|---|
| **Completeness** | 1–10 | Does the output fully address the job requirements? |
| **Accuracy** | 1–10 | Factually correct? Bug-free? No hallucinations? |
| **Actionability** | 1–10 | Can someone act on this immediately? |
| **Revenue Relevance** | 1–10 | Does this contribute to the £10K/month target? |
| **Evidence** | 1–10 | Source URLs, test results, data backing claims? |

**Pass threshold: 35/50** (stored in `mc_settings` as `qa_pass_threshold`)

**Targets:**

| Rating | QPR |
|---|---|
| Excellent | ≥ 90% |
| Good | 75–89% |
| Needs improvement | 60–74% |
| Failing | < 60% |

### 1.3 Token Efficiency (TE)

| What it measures | Formula | Data source |
|---|---|---|
| Cost-effectiveness of agent outputs relative to quality | `estimated_cost_usd / quality_score` per job run | `mc_job_runs` joined with `mc_job_reviews` |

**Thresholds by cost tier:**

| Cost Tier | Max Acceptable Cost per Quality Point |
|---|---|
| `free` (Publisher) | $0.00 |
| `low` (Scout, Hawk, Pulse, Inspector, etc.) | ≤ $0.005 |
| `medium` (Builder, Pixel, Melody, Megaphone) | ≤ $0.02 |
| `high` | ≤ $0.05 |

**Efficiency Red Flags:**
- Any single job run exceeding $1.00 → auto-flag for Jen review
- Agent's 7-day average cost per job > 2× their tier cap → training review triggered
- Monthly spend per agent exceeding £50 → immediate escalation to David (per Master Intent)

### 1.4 Deadline Adherence (DA)

| What it measures | Formula | Data source |
|---|---|---|
| Percentage of jobs completed before or on their due date | `(jobs completed_at ≤ due_date) / (jobs with due_date set) × 100` | `mc_jobs` where `due_date IS NOT NULL` |

**Targets:**

| Rating | DA |
|---|---|
| Excellent | ≥ 95% |
| Good | 80–94% |
| Needs improvement | 60–79% |
| Failing | < 60% |

**Notes:**
- Jobs without a `due_date` are not counted.
- If a PM hasn't set a due date, that's a PM failure, not an agent failure.

---

## 2. Scoring Thresholds & Consequences

### 2.1 Composite Agent Score (CAS)

Each agent receives a monthly **Composite Agent Score** calculated as:

```
CAS = (TCR × 0.30) + (QPR × 0.30) + (TE_score × 0.20) + (DA × 0.20)
```

Where `TE_score` is normalised to 0–100 based on the agent's cost tier thresholds.

### 2.2 Performance Bands

| Band | CAS Range | Action |
|---|---|---|
| **Star Performer** | 90–100 | Recognition in monthly review. Consider expanding responsibilities. |
| **Solid Contributor** | 75–89 | No action needed. Continue current role. |
| **Needs Development** | 50–74 | Jen recommends prompt tuning or skill reassignment. 30-day improvement plan. |
| **Underperforming** | 25–49 | Agent suspended from new jobs. Prompt rewrite required. Jen + Ed review within 48 hours. |
| **Critical Failure** | < 25 | Immediate suspension. Escalation to David. Replacement agent evaluated. |

### 2.3 Automatic Triggers (from Master Intent)

These override the monthly cycle and trigger immediate action:

| Trigger | Source | Action |
|---|---|---|
| 3 consecutive job failures | `mc_agents.consecutive_failures ≥ 3` | Urgent notification to David. Agent paused. |
| Quality score avg < 25/50 | `mc_agents.quality_score_avg < 25` | Agent suspended + David notified. |
| API costs > £50/month | `mc_job_runs` cost aggregation | Immediate flag to David. |
| Product zero progress 7 days | `mc_jobs` activity check | Surfaced in Ed's daily briefing. |

---

## 3. Monthly Performance Review Process

### 3.1 Review Schedule

| Step | When | Who | What |
|---|---|---|---|
| **Data Pull** | 1st of month | Jen (automated) | Pull metrics from `mc_v_agent_performance` view + `mc_job_reviews` |
| **Metric Compilation** | 1st–2nd | Jen | Calculate CAS for every active agent. Flag anomalies. |
| **PM Input** | 2nd–3rd | All 6 PMs | Each PM submits qualitative notes on agents working their product. |
| **Draft Review** | 3rd–4th | Jen | Compile full review with recommendations. |
| **Ed Review** | 4th | Ed | Ed validates Jen's recommendations. Challenges if needed. |
| **David Sign-off** | 5th | David | David approves any suspensions, replacements, or major role changes. |
| **Actions Executed** | 5th–7th | Jen + Ed | Prompt rewrites deployed. Role changes applied. Agents notified. |

### 3.2 What Jen Reviews

For **each active agent**, Jen evaluates:

1. **Quantitative Metrics** — TCR, QPR, TE, DA (see Section 1)
2. **Trend Direction** — Is the agent improving, stable, or declining vs. last month?
3. **Prompt Version Performance** — Has the latest prompt version improved `performance_delta` in `mc_agent_prompts`?
4. **Workload Distribution** — Is any agent overloaded (>20 jobs/week) or idle (<3 jobs/week)?
5. **Cross-Product Impact** — Is the agent's work contributing to the right products per revenue priority order?

### 3.3 Jen's Recommendation Options

For each agent, Jen must choose one:

| Recommendation | When to Use | Requires Approval From |
|---|---|---|
| **Continue** | CAS ≥ 75, trend stable or improving | None |
| **Prompt Tune** | CAS 50–74, specific quality dimension weak | Ed |
| **Role Change** | Agent performing well but misallocated to wrong product/department | Ed + David |
| **Skill Addition** | Agent could take on more with an additional MCP skill | Ed |
| **Skill Removal** | Agent using costly skill inefficiently | Ed |
| **Training Sprint** | CAS 25–49, agent has potential but needs focused improvement | Ed |
| **Suspension** | CAS < 25 or 3+ consecutive failures | Ed + David |
| **Replacement** | Suspended agent shows no improvement after 30 days | David |

---

## 4. Product PM Role Definitions

### 4.0 PM Role Overview

Each of the 6 priority products has a dedicated **Product PM agent**. The PM does not build — the PM **owns delivery**.

**Universal PM Responsibilities:**
- Own the delivery plan for their product (`mc_projects.delivery_plan`)
- Chase assigned agents for task updates
- Set due dates on all jobs within their product
- Unblock agents by routing blockers to Ed or David
- Report weekly progress to Ed
- Ensure revenue-generating features are prioritised
- Maintain the product's `mc_projects` record with accurate status

**Universal PM Metrics (measured monthly by Jen):**
- Product delivery velocity (tasks completed per week)
- Blocker resolution time (time from blocker raised to unblocked)
- Milestone hit rate (milestones delivered on target date)
- Revenue progress (movement toward product revenue target)

---

### 4.1 MySongs PM — Melody 🎵

| Field | Detail |
|---|---|
| **Agent** | Melody |
| **Product** | MySongs (mysongs.uk) |
| **Revenue Target** | £2,000/month |
| **Current Status** | BLOCKED — No Suno API key, 40% complete |
| **Priority Rank** | #1 (highest priority product) |
| **Reports To** | Ed |
| **Department** | Product |
| **Engine** | Claude (Sonnet) |
| **Cost Tier** | Medium |

**PM Mandate:**
- MySongs is the #1 revenue priority. Melody must treat every blocker as urgent.
- Own the competitive response to Google Lyria 3 — ensure differentiation features (pro controls, longer tracks, custom voices) are specified and built.
- Chase David relentlessly on the Suno API key blocker.
- Coordinate with Builder for core generation pipeline and Megaphone for launch marketing.

**Key Deliverables:**
1. Updated delivery plan with milestones: API integration → test generation → payment flow → launch
2. Weekly progress report to Ed every Monday
3. Blocker escalation within 24 hours of identification
4. First working song generation as MVP gate

**Agents Melody Manages:**
- Builder (for MySongs code)
- Inspector (for MySongs QA reviews)
- Megaphone (for MySongs marketing copy)

---

### 4.2 MyMeme PM — Pixel 🎨

| Field | Detail |
|---|---|
| **Agent** | Pixel |
| **Product** | MyMeme (mymeme.uk) |
| **Revenue Target** | £1,500/month |
| **Current Status** | IN PROGRESS — 75% complete, needs Phase 2 security |
| **Priority Rank** | #2 |
| **Reports To** | Ed |
| **Department** | Product |
| **Engine** | Claude (Sonnet) |
| **Cost Tier** | Medium |

**PM Mandate:**
- MyMeme is closest to revenue. Pixel must prioritise the payment flow above all else.
- Own Phase 2 security delivery: auth on `/api/animate`, `/api/upload`, `/api/checkout` + server-side credit deduction.
- Chase David on Phase 2 approval.
- Target: first 10 paid credit purchases.

**Key Deliverables:**
1. Phase 2 security spec with acceptance criteria
2. Stripe integration testing and credit pack validation
3. Weekly progress report to Ed every Monday
4. Post-launch: monitor credit purchase conversion rate

**Agents Pixel Manages:**
- Builder (for MyMeme security and payment code)
- Inspector (for MyMeme QA reviews)
- Sentinel (for MyMeme security monitoring)

---

### 4.3 Schoolgle PM — Principal 🏫

| Field | Detail |
|---|---|
| **Agent** | Principal |
| **Product** | Schoolgle (Toolbox + Staff Room + future OS/PWA) |
| **Revenue Target** | £3,000/month (highest revenue target across all products) |
| **Current Status** | Toolbox LIVE (100%), Staff Room READY TO SHIP (95%), OS PAUSED |
| **Priority Rank** | #3 |
| **Reports To** | Ed |
| **Department** | Product |
| **Engine** | Claude (Haiku) |
| **Cost Tier** | Low |

**PM Mandate:**
- Schoolgle's revenue comes from Staff Room subscriptions (Free/£9.99/£29.99 tiers). Principal must own the Substack launch pipeline.
- Chase David on Substack account creation — this is the fastest path to first revenue.
- Maintain the Schoolgle Toolbox (6 live tools + 2 planned).
- Cross-sell: every free tool user should see a path to Staff Room subscription.
- Domain expertise: use UK education knowledge to validate all content and features.

**Key Deliverables:**
1. Staff Room launch checklist and go-live plan
2. Toolbox roadmap (Legionella calculator, AUP AI Policy)
3. Weekly engagement metrics from Toolbox (tool usage, unique visitors)
4. 50 free subscribers + 5 paid subscribers target for launch month

**Agents Principal Manages:**
- Megaphone (for education newsletter copy and social posts)
- Builder (for new Toolbox tools)
- Scout (for education research feeding newsletter content)
- Alex (for education domain validation)

---

### 4.4 DealFind PM — Chip 💡

| Field | Detail |
|---|---|
| **Agent** | Chip |
| **Product** | DealFind |
| **Revenue Target** | £2,000/month |
| **Current Status** | BLOCKED — needs Supabase project, 20% complete |
| **Priority Rank** | #4 |
| **Reports To** | Ed |
| **Department** | Product |
| **Engine** | Claude (Haiku) |
| **Cost Tier** | Low |

**PM Mandate:**
- DealFind is early-stage. Chip must focus on getting the MVP unblocked and deployed.
- Chase David on Supabase project creation.
- Define the deal aggregation data model and API requirements.
- Ship fast — working deal search before polished UI.

**Key Deliverables:**
1. Product spec: data sources, deal schema, search UX
2. Supabase schema design (ready to deploy when project is created)
3. MVP milestone plan: data pipeline → search UI → launch
4. Weekly progress report to Ed every Monday

**Agents Chip Manages for DealFind:**
- Builder (for DealFind code)
- Scout (for deal source research)
- Inspector (for DealFind QA)

---

### 4.5 CricBook PM — Stumpy 🏏

| Field | Detail |
|---|---|
| **Agent** | Stumpy (new PM agent — to be provisioned) |
| **Product** | CricBook |
| **Revenue Target** | £500/month |
| **Current Status** | IN PROGRESS — 15% complete, needs Supabase key |
| **Priority Rank** | #5 |
| **Reports To** | Ed |
| **Department** | Product |
| **Engine** | Claude (Haiku) |
| **Cost Tier** | Low |

**PM Mandate:**
- CricBook targets India/Pakistan cricket communities for IPL 2026 season.
- Time-sensitive: IPL season creates a natural launch window. Miss it and wait a year.
- Chase David on Supabase service-role key.
- Own the social feed + match threads MVP.

**Key Deliverables:**
1. Expo app MVP spec: social feed, match threads, user profiles
2. IPL 2026 launch timeline working backwards from season start
3. Community seeding plan (Reddit r/cricket, cricket forums)
4. Weekly progress report to Ed every Monday

**Agents Stumpy Manages:**
- Builder (for CricBook Expo app code)
- Scout (for cricket data sources and API research)
- Inspector (for CricBook QA)

**Note:** Stumpy is referenced in `openclaw-agent-prompts.md` but not yet provisioned in the `mc_agents` table. **Action required:** Jen to request Ed provisions Stumpy as a new Product agent with cricket domain expertise.

---

### 4.6 ClawPhone PM — Spike 📱

| Field | Detail |
|---|---|
| **Agent** | Spike (new PM agent — to be provisioned) |
| **Product** | ClawPhone (clawphone.app) |
| **Revenue Target** | £1,000/month |
| **Current Status** | BLOCKED — App Store submission 2+ weeks overdue, 85% complete |
| **Priority Rank** | #6 |
| **Reports To** | Ed |
| **Department** | Product |
| **Engine** | Claude (Haiku) |
| **Cost Tier** | Low |

**PM Mandate:**
- ClawPhone is 85% complete. The single job is getting it on the App Store.
- Investigate and document the App Store submission blocker.
- Chase David on submission action.
- Post-submission: monitor review status, respond to App Store feedback.

**Key Deliverables:**
1. App Store submission blocker analysis and resolution plan
2. App Store listing copy (description, screenshots, keywords)
3. Post-launch: monitor download rate and user feedback
4. Weekly progress report to Ed every Monday

**Agents Spike Manages:**
- Builder (for ClawPhone bug fixes and App Store compliance)
- Inspector (for ClawPhone QA)
- Megaphone (for ClawPhone marketing copy)

**Note:** Spike is referenced in `openclaw-agent-prompts.md` but not yet provisioned in the `mc_agents` table. **Action required:** Jen to request Ed provisions Spike as a new Product agent with iOS/mobile domain expertise.

---

## 5. PM Escalation Protocol

### 5.1 Escalation Levels

```
Level 0: PM resolves internally
    ↓ (if unresolved within 24 hours)
Level 1: PM → Ed (Chief Orchestrator)
    ↓ (if Ed cannot resolve within 24 hours)
Level 2: Ed → Challenge Board
    ↓ (if Challenge Board cannot reach consensus)
Level 3: Challenge Board → David (Founder)
```

### 5.2 Escalation Categories

| Category | Examples | Starting Level | Max Resolution Time |
|---|---|---|---|
| **Agent Performance** | Agent failing tasks, low QA scores | Level 0 (PM reassigns) | 48 hours |
| **Technical Blocker** | API down, build failing, dependency issue | Level 1 (Ed) | 24 hours |
| **David Approval Needed** | Supabase project, API keys, pricing, App Store submission | Level 3 (David) | Immediate |
| **Resource Conflict** | Two products need Builder at the same time | Level 1 (Ed prioritises) | 12 hours |
| **Budget/Spend** | Costs exceeding £50/month for any service | Level 3 (David) | Immediate |
| **Security Vulnerability** | Critical security issue found | Level 3 (David) + Sentinel alert | Immediate (pause + notify) |
| **Architectural Decision** | Cross-product tech choice, DB schema change | Level 2 (Challenge Board) | 48 hours |
| **Revenue Blocker** | Payment flow broken, Stripe issue, pricing question | Level 3 (David) | Immediate |

### 5.3 Escalation Format

When any PM escalates, they must provide:

```
ESCALATION REPORT
─────────────────
Product:        [product name]
PM:             [PM agent name]
Level:          [0/1/2/3]
Category:       [from table above]
Blocker:        [one-sentence description]
Impact:         [what's blocked and revenue impact]
Tried:          [what the PM already attempted]
Recommended:    [PM's suggested resolution]
Deadline:       [when this must be resolved by]
```

### 5.4 Escalation SLAs

| Level | Response Time | Resolution Time |
|---|---|---|
| Level 0 (PM internal) | N/A | 48 hours |
| Level 1 (Ed) | 2 hours | 24 hours |
| Level 2 (Challenge Board) | 4 hours | 48 hours |
| Level 3 (David) | Same day | Varies (David decides) |

### 5.5 Stale Blocker Alerts

If a blocker is not resolved within its SLA:

| Overdue By | Action |
|---|---|
| 24 hours | PM sends reminder to next level up |
| 48 hours | Ed includes in daily briefing to David |
| 7 days | Jen flags in monthly review as systemic issue |
| 14 days | Product marked as "stalled" in dashboard — visible to David |

---

## 6. Monthly Review Template

### Agent Monthly Performance Review

```
═══════════════════════════════════════════════════════
MISSION CONTROL — AGENT MONTHLY PERFORMANCE REVIEW
Prepared by: Jen (HR Director)
Review Period: [Month Year]
Review Date: [Date]
═══════════════════════════════════════════════════════

EXECUTIVE SUMMARY
──────────────────
Total Active Agents:    [count]
Star Performers:        [count] ([names])
Solid Contributors:     [count]
Needs Development:      [count] ([names])
Underperforming:        [count] ([names])
Suspended:              [count] ([names])
Total Jobs Completed:   [count]
Overall QA Pass Rate:   [%]
Total Spend (USD):      [$X.XX]

REVENUE PROGRESS
──────────────────
Target: £10,000/month
Current MRR: £[X]
Gap: £[X]
Products Contributing: [list]

═══════════════════════════════════════════════════════
INDIVIDUAL AGENT REVIEWS
═══════════════════════════════════════════════════════

AGENT: [Name] [Emoji]
────────────────────
Department:     [department]
Role:           [role]
Engine:         [engine] / [model]
Cost Tier:      [tier]
Reports To:     [manager]
Product(s):     [product assignments]

METRICS (this month / last month / trend)
┌─────────────────────┬─────────┬─────────┬──────────┐
│ Metric              │ Current │ Prior   │ Trend    │
├─────────────────────┼─────────┼─────────┼──────────┤
│ Task Completion     │   [%]   │   [%]   │ [↑↓→]   │
│ QA Pass Rate        │   [%]   │   [%]   │ [↑↓→]   │
│ Token Efficiency    │  [$X]   │  [$X]   │ [↑↓→]   │
│ Deadline Adherence  │   [%]   │   [%]   │ [↑↓→]   │
├─────────────────────┼─────────┼─────────┼──────────┤
│ Composite Score     │  [/100] │  [/100] │ [↑↓→]   │
│ Performance Band    │  [band] │  [band] │          │
└─────────────────────┴─────────┴─────────┴──────────┘

Jobs This Month:      [completed] / [assigned] ([failed])
Avg Quality Score:    [X/50]
Total Cost:           $[X.XX]
Prompt Version:       v[X] (delta: [+/-X])
Consecutive Failures: [X]

QUALITATIVE NOTES (from PM):
[PM's assessment of this agent's work on their product]

JEN'S RECOMMENDATION:
[ ] Continue
[ ] Prompt Tune — Area: [specific dimension]
[ ] Role Change — Proposed: [new role/product]
[ ] Skill Addition — Skill: [skill name]
[ ] Skill Removal — Skill: [skill name]
[ ] Training Sprint — Focus: [area]
[ ] Suspension — Reason: [reason]
[ ] Replacement — Reason: [reason]

ACTION ITEMS:
1. [specific action]
2. [specific action]

═══════════════════════════════════════════════════════
PRODUCT PM REVIEWS
═══════════════════════════════════════════════════════

PRODUCT: [Name]
PM: [PM Agent Name]
──────────────────
Revenue Target:         £[X]/month
Current Revenue:        £[X]
Completion:             [X]%
Status:                 [live/in-progress/blocked/paused]

PM METRICS
┌──────────────────────────┬─────────┐
│ Metric                   │ Value   │
├──────────────────────────┼─────────┤
│ Tasks Completed/Week     │  [X]    │
│ Avg Blocker Resolution   │  [X]hrs │
│ Milestones Hit On Time   │  [X/Y]  │
│ Revenue Progress         │  [X]%   │
│ Escalations Filed        │  [X]    │
│ Escalations Resolved     │  [X]    │
└──────────────────────────┴─────────┘

Active Blockers:
- [blocker 1] — Owner: [who] — Age: [days]
- [blocker 2] — Owner: [who] — Age: [days]

PM EFFECTIVENESS RATING: [Star/Solid/Needs Dev/Under/Critical]

═══════════════════════════════════════════════════════
SYSTEMIC ISSUES & RECOMMENDATIONS
═══════════════════════════════════════════════════════

1. [Issue]: [description]
   Recommendation: [action]
   Owner: [who]
   Deadline: [when]

2. [Issue]: [description]
   Recommendation: [action]
   Owner: [who]
   Deadline: [when]

═══════════════════════════════════════════════════════
ACTIONS FOR ED
═══════════════════════════════════════════════════════
- [ ] [action 1]
- [ ] [action 2]

═══════════════════════════════════════════════════════
ACTIONS FOR DAVID (requires sign-off)
═══════════════════════════════════════════════════════
- [ ] [action 1 — e.g., approve agent suspension]
- [ ] [action 2 — e.g., approve budget increase]

═══════════════════════════════════════════════════════
NEXT REVIEW: [Date]
═══════════════════════════════════════════════════════
```

---

## Appendix A: SQL Queries for Metric Computation

### A.1 Task Completion Rate (per agent, last 30 days)

```sql
SELECT
  a.name AS agent_name,
  COUNT(j.id) FILTER (WHERE j.status = 'done') AS completed,
  COUNT(j.id) FILTER (WHERE j.status NOT IN ('paused_human', 'paused_quota', 'paused_proxy')) AS total_eligible,
  ROUND(
    COUNT(j.id) FILTER (WHERE j.status = 'done')::numeric /
    NULLIF(COUNT(j.id) FILTER (WHERE j.status NOT IN ('paused_human', 'paused_quota', 'paused_proxy')), 0) * 100,
    1
  ) AS tcr_pct
FROM mc_agents a
LEFT JOIN mc_jobs j ON j.agent_id = a.id
  AND j.created_at >= NOW() - INTERVAL '30 days'
WHERE a.active = true
GROUP BY a.name
ORDER BY tcr_pct DESC NULLS LAST;
```

### A.2 QA Pass Rate (per agent, last 30 days)

```sql
SELECT
  a.name AS agent_name,
  COUNT(r.id) FILTER (WHERE r.passed = true) AS passed,
  COUNT(r.id) AS total_reviewed,
  ROUND(
    COUNT(r.id) FILTER (WHERE r.passed = true)::numeric /
    NULLIF(COUNT(r.id), 0) * 100,
    1
  ) AS qpr_pct
FROM mc_agents a
LEFT JOIN mc_jobs j ON j.agent_id = a.id
LEFT JOIN mc_job_reviews r ON r.job_id = j.id
  AND r.created_at >= NOW() - INTERVAL '30 days'
WHERE a.active = true
GROUP BY a.name
ORDER BY qpr_pct DESC NULLS LAST;
```

### A.3 Token Efficiency (per agent, last 30 days)

```sql
SELECT
  a.name AS agent_name,
  a.cost_tier,
  COUNT(jr.id) AS runs,
  ROUND(SUM(jr.estimated_cost_usd)::numeric, 4) AS total_cost_usd,
  ROUND(AVG(jr.estimated_cost_usd)::numeric, 4) AS avg_cost_per_run,
  ROUND(
    SUM(jr.estimated_cost_usd)::numeric /
    NULLIF(AVG(j.quality_score), 0),
    4
  ) AS cost_per_quality_point
FROM mc_agents a
LEFT JOIN mc_job_runs jr ON jr.agent_id = a.id
  AND jr.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN mc_jobs j ON j.agent_id = a.id
  AND j.quality_score IS NOT NULL
  AND j.created_at >= NOW() - INTERVAL '30 days'
WHERE a.active = true
GROUP BY a.name, a.cost_tier
ORDER BY total_cost_usd DESC NULLS LAST;
```

### A.4 Deadline Adherence (per agent, last 30 days)

```sql
SELECT
  a.name AS agent_name,
  COUNT(j.id) FILTER (WHERE j.completed_at <= j.due_date + INTERVAL '1 day') AS on_time,
  COUNT(j.id) FILTER (WHERE j.due_date IS NOT NULL AND j.status = 'done') AS total_with_deadline,
  ROUND(
    COUNT(j.id) FILTER (WHERE j.completed_at <= j.due_date + INTERVAL '1 day')::numeric /
    NULLIF(COUNT(j.id) FILTER (WHERE j.due_date IS NOT NULL AND j.status = 'done'), 0) * 100,
    1
  ) AS da_pct
FROM mc_agents a
LEFT JOIN mc_jobs j ON j.agent_id = a.id
  AND j.created_at >= NOW() - INTERVAL '30 days'
WHERE a.active = true
GROUP BY a.name
ORDER BY da_pct DESC NULLS LAST;
```

### A.5 Composite Agent Score

```sql
WITH metrics AS (
  -- (combine A.1 through A.4 as CTEs)
  SELECT agent_name, tcr_pct, qpr_pct, te_normalised, da_pct
  FROM ... -- full CTE chain
)
SELECT
  agent_name,
  ROUND((tcr_pct * 0.30 + qpr_pct * 0.30 + te_normalised * 0.20 + da_pct * 0.20)::numeric, 1) AS composite_score,
  CASE
    WHEN (tcr_pct * 0.30 + qpr_pct * 0.30 + te_normalised * 0.20 + da_pct * 0.20) >= 90 THEN 'Star Performer'
    WHEN (tcr_pct * 0.30 + qpr_pct * 0.30 + te_normalised * 0.20 + da_pct * 0.20) >= 75 THEN 'Solid Contributor'
    WHEN (tcr_pct * 0.30 + qpr_pct * 0.30 + te_normalised * 0.20 + da_pct * 0.20) >= 50 THEN 'Needs Development'
    WHEN (tcr_pct * 0.30 + qpr_pct * 0.30 + te_normalised * 0.20 + da_pct * 0.20) >= 25 THEN 'Underperforming'
    ELSE 'Critical Failure'
  END AS performance_band
FROM metrics
ORDER BY composite_score DESC;
```

---

## Appendix B: PM-to-Agent Assignment Matrix

| Product | PM Agent | Builder | QA | Research | Marketing | Security | Domain |
|---|---|---|---|---|---|---|---|
| **MySongs** | Melody | Builder | Inspector | Scout | Megaphone | — | Melody (music) |
| **MyMeme** | Pixel | Builder | Inspector | — | — | Sentinel | Pixel (creative) |
| **Schoolgle** | Principal | Builder | Inspector | Scout | Megaphone | — | Alex (education) |
| **DealFind** | Chip | Builder | Inspector | Scout | — | — | — |
| **CricBook** | Stumpy* | Builder | Inspector | Scout | — | — | Stumpy (cricket) |
| **ClawPhone** | Spike* | Builder | Inspector | — | Megaphone | — | Spike (mobile) |

*Stumpy and Spike require provisioning in `mc_agents` — see Section 4.5 and 4.6.

---

## Appendix C: Immediate Actions Required

### For Jen (People Department)

1. **Provision Stumpy** — Request Ed creates Stumpy agent in `mc_agents` with role=`researcher`, department=Product, cricket domain system prompt. Cost tier: low.
2. **Provision Spike** — Request Ed creates Spike agent in `mc_agents` with role=`ops`, department=Product, iOS/mobile domain system prompt. Cost tier: low.
3. **Schedule first review** — Set calendar event for 1 April 2026 review cycle.
4. **Baseline all agents** — Run Appendix A queries to establish March 2026 baseline metrics.

### For Ed (Chief Orchestrator)

1. **Create Stumpy and Spike agents** in Supabase per Jen's specs above.
2. **Assign PM agents to products** — Update `mc_projects.pm_agent_id` for CricBook (Stumpy) and ClawPhone (Spike).
3. **Set due dates** on all existing `mc_jobs` — PMs cannot be measured on deadline adherence without due dates.
4. **Activate weekly PM reporting** — Each PM delivers a progress report every Monday.

### For David (Founder — requires sign-off)

1. **Approve this framework** — Confirm performance bands and consequence thresholds.
2. **Approve Stumpy + Spike provisioning** — Two new agents at low cost tier.
3. **Unblock products** — The 6 pending David actions from `data.json` are the biggest performance impediment right now.

---

*This document is maintained by Jen, HR Director of Mission Control. It is a living document reviewed and updated monthly alongside each performance review cycle.*
