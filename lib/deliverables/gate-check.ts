import { supabaseAdmin } from '@/lib/db/supabase-server';

export type GateStatus = {
  total: number;
  approved: number;
  allApproved: boolean;
};

const PLANNING_TYPES = ['prd', 'spec', 'research'];

export async function checkPlanningGate(projectId: string): Promise<GateStatus> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('mc_project_deliverables')
    .select('id, status')
    .eq('project_id', projectId)
    .in('deliverable_type', PLANNING_TYPES);

  if (error) throw new Error(`gate-check failed: ${error.message}`);

  const items = data || [];
  const approved = items.filter(d => d.status === 'approved').length;

  return {
    total: items.length,
    approved,
    allApproved: items.length > 0 && approved === items.length,
  };
}
