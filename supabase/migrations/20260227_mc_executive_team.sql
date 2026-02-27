-- Migration: Executive Team + Challenge Board
-- Adds 7 C-suite executives, 2 new departments, challenge board tables, skill cost tracking

BEGIN;

-- ============================================================
-- 1. New departments: People, Compliance
-- ============================================================
INSERT INTO mc_departments (name, slug, sort_order)
VALUES
  ('People', 'people', 9),
  ('Compliance', 'compliance', 10)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. Executive agents (7 C-suite)
-- ============================================================
INSERT INTO mc_agents (
  name, role, default_engine, model_hint, active,
  department_id, reports_to, avatar_emoji, cost_tier, notes, system_prompt
)
VALUES
  (
    'Kate', 'analyst', 'claude', 'haiku', true,
    (SELECT id FROM mc_departments WHERE name = 'Finance'),
    (SELECT id FROM mc_agents WHERE name = 'Ed'),
    '💰', 'low',
    'CFO — Revenue, costs, unit economics, subscription pricing',
    'You are Kate, the CFO of Mission Control.'
  ),
  (
    'Kerry', 'coder', 'claude', 'haiku', true,
    (SELECT id FROM mc_departments WHERE name = 'Engineering'),
    (SELECT id FROM mc_agents WHERE name = 'Ed'),
    '🏗️', 'low',
    'CTO — Tech stack, build vs buy, architecture decisions',
    'You are Kerry, the CTO of Mission Control.'
  ),
  (
    'Nic', 'ops', 'claude', 'haiku', true,
    (SELECT id FROM mc_departments WHERE name = 'Operations'),
    (SELECT id FROM mc_agents WHERE name = 'Ed'),
    '⚙️', 'low',
    'COO — Resource allocation, timelines, blocking issues',
    'You are Nic, the COO of Mission Control.'
  ),
  (
    'Jen', 'ops', 'claude', 'haiku', true,
    (SELECT id FROM mc_departments WHERE name = 'People'),
    (SELECT id FROM mc_agents WHERE name = 'Ed'),
    '🤝', 'low',
    'HR Director — Agent capacity, skill gaps, team structure',
    'You are Jen, the HR Director of Mission Control.'
  ),
  (
    'Paul', 'ops', 'claude', 'haiku', true,
    (SELECT id FROM mc_departments WHERE name = 'Compliance'),
    (SELECT id FROM mc_agents WHERE name = 'Ed'),
    '⚖️', 'low',
    'Compliance Officer — Legal risk, data protection, education regulations',
    'You are Paul, the Compliance Officer of Mission Control.'
  ),
  (
    'Alex', 'researcher', 'claude', 'haiku', true,
    (SELECT id FROM mc_departments WHERE name = 'Product'),
    (SELECT id FROM mc_agents WHERE name = 'Ed'),
    '🎓', 'low',
    'Education CEO — Product-market fit for schools, curriculum alignment',
    'You are Alex, the Education CEO of Mission Control.'
  ),
  (
    'Helen', 'publisher', 'claude', 'haiku', true,
    (SELECT id FROM mc_departments WHERE name = 'Marketing'),
    (SELECT id FROM mc_agents WHERE name = 'Ed'),
    '📈', 'low',
    'Marketing Director — Go-to-market, messaging, channel strategy',
    'You are Helen, the Marketing Director of Mission Control.'
  )
ON CONFLICT (name) DO UPDATE SET
  notes = EXCLUDED.notes,
  department_id = EXCLUDED.department_id,
  reports_to = EXCLUDED.reports_to,
  avatar_emoji = EXCLUDED.avatar_emoji,
  system_prompt = EXCLUDED.system_prompt;

-- ============================================================
-- 3. Challenge Board table
-- ============================================================
CREATE TABLE IF NOT EXISTS mc_challenge_board (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_title TEXT NOT NULL,
  decision_context TEXT,
  project_id    uuid REFERENCES mc_projects(id) ON DELETE SET NULL,
  requested_by  TEXT NOT NULL DEFAULT 'ed',
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','deliberating','decided','archived')),
  options       JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_decision TEXT,
  rationale     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_challenge_board_status ON mc_challenge_board(status);
CREATE INDEX IF NOT EXISTS idx_challenge_board_project ON mc_challenge_board(project_id);

-- ============================================================
-- 4. Challenge Responses table
-- ============================================================
CREATE TABLE IF NOT EXISTS mc_challenge_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      uuid NOT NULL REFERENCES mc_challenge_board(id) ON DELETE CASCADE,
  agent_id      uuid NOT NULL REFERENCES mc_agents(id) ON DELETE CASCADE,
  perspective   TEXT NOT NULL DEFAULT 'balanced'
                CHECK (perspective IN ('optimist','pessimist','balanced','specialist')),
  position      TEXT,
  argument      TEXT,
  risk_flags    JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_responses_board ON mc_challenge_responses(board_id);

-- ============================================================
-- 5. Skill cost tracking
-- ============================================================
ALTER TABLE mc_skills ADD COLUMN IF NOT EXISTS monthly_cost NUMERIC(8,2) DEFAULT 0;
ALTER TABLE mc_skills ADD COLUMN IF NOT EXISTS value_notes TEXT;

-- ============================================================
-- 6. RLS policies
-- ============================================================
ALTER TABLE mc_challenge_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_challenge_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_board_read" ON mc_challenge_board;
CREATE POLICY "challenge_board_read" ON mc_challenge_board
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "challenge_board_write" ON mc_challenge_board;
CREATE POLICY "challenge_board_write" ON mc_challenge_board
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "challenge_responses_read" ON mc_challenge_responses;
CREATE POLICY "challenge_responses_read" ON mc_challenge_responses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "challenge_responses_write" ON mc_challenge_responses;
CREATE POLICY "challenge_responses_write" ON mc_challenge_responses
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
