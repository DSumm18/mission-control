-- Job complexity routing + retry tracking
-- Phase D: Automation + Parallel Execution

ALTER TABLE mc_jobs ADD COLUMN IF NOT EXISTS complexity_tier TEXT
  CHECK (complexity_tier IN ('low', 'medium', 'high'));

ALTER TABLE mc_jobs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

ALTER TABLE mc_jobs ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_mc_jobs_batch ON mc_jobs(batch_id) WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_jobs_complexity ON mc_jobs(complexity_tier) WHERE complexity_tier IS NOT NULL;

-- Add repo_path to jobs (for project-launched jobs)
ALTER TABLE mc_jobs ADD COLUMN IF NOT EXISTS repo_path TEXT;
