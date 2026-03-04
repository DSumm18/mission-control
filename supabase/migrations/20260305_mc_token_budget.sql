-- Token budget: append-only ledger + per-agent budget columns + tier defaults

-- mc_token_usage ledger
CREATE TABLE mc_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES mc_agents(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('chat','job','estimate')),
  source_id text,
  tokens_in int NOT NULL DEFAULT 0,
  tokens_out int NOT NULL DEFAULT 0,
  engine text,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mc_token_usage_agent_day ON mc_token_usage (agent_id, created_at DESC);

-- Agent budget columns
ALTER TABLE mc_agents ADD COLUMN IF NOT EXISTS daily_token_budget int;
ALTER TABLE mc_agents ADD COLUMN IF NOT EXISTS budget_paused_at timestamptz;

-- Default tier budgets
INSERT INTO mc_settings (key, value) VALUES
  ('token_budget_by_tier', '{"free":0,"low":100000,"medium":250000,"high":500000}')
ON CONFLICT (key) DO NOTHING;
