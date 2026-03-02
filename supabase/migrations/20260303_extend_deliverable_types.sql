-- Extend deliverable types to include documentation categories
-- guide, runbook, architecture, changelog are docs (not planning-gate blockers)

ALTER TABLE mc_project_deliverables
  DROP CONSTRAINT IF EXISTS mc_project_deliverables_deliverable_type_check;

ALTER TABLE mc_project_deliverables
  ADD CONSTRAINT mc_project_deliverables_deliverable_type_check
  CHECK (deliverable_type IN (
    'prd','spec','research','analysis','design','other',
    'guide','runbook','architecture','changelog'
  ));
