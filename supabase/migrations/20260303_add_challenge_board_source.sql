-- Allow 'challenge_board' as a valid job source for executive challenge jobs
ALTER TABLE mc_jobs DROP CONSTRAINT IF EXISTS mc_jobs_source_check;
ALTER TABLE mc_jobs ADD CONSTRAINT mc_jobs_source_check
  CHECK (source IN ('dashboard','telegram','cron','orchestrator','api','challenge_board'));
