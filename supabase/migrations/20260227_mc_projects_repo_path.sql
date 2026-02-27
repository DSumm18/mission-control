-- Add repo_path to projects so Ed and agents can scan codebases
ALTER TABLE mc_projects ADD COLUMN IF NOT EXISTS repo_path TEXT;

-- Also add assignee to tasks so Ed can assign work to David vs agents
ALTER TABLE mc_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT 'unassigned'
  CHECK (assigned_to IN ('david', 'ed', 'agent', 'unassigned'));
ALTER TABLE mc_tasks ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES mc_agents(id) ON DELETE SET NULL;
ALTER TABLE mc_tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'action'
  CHECK (task_type IN ('action', 'decision', 'review', 'sign_off', 'blocker'));
