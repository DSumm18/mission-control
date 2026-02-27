/**
 * Challenge Board orchestration.
 * Creates debates, dispatches executive challengers, synthesises results.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import { EXECUTIVES, buildChallengePrompt } from './executive-prompts';

interface CreateBoardParams {
  title: string;
  context: string;
  options: string[];
  challengers: string[];
  projectId?: string;
}

interface ChallengeResponse {
  agent_name: string;
  agent_title: string;
  perspective: string;
  position: string;
  argument: string;
  risk_flags: { risk: string; severity: string; mitigation: string }[];
}

interface BoardSummary {
  board_id: string;
  title: string;
  options: {
    label: string;
    summary: string;
    recommended_by: string[];
    pros: string[];
    cons: string[];
  }[];
  responses: ChallengeResponse[];
  status: string;
}

/**
 * Create a challenge board and dispatch jobs for each executive challenger.
 */
export async function createChallengeBoard(params: CreateBoardParams): Promise<{
  board_id: string;
  job_ids: string[];
}> {
  const sb = supabaseAdmin();

  // Build structured options
  const optionsJson = params.options.map((o, i) => ({
    label: String.fromCharCode(65 + i),
    summary: o,
    recommended_by: [] as string[],
    pros: [] as string[],
    cons: [] as string[],
  }));

  // Create the board
  const { data: board, error: boardErr } = await sb
    .from('mc_challenge_board')
    .insert({
      decision_title: params.title,
      decision_context: params.context,
      project_id: params.projectId || null,
      requested_by: 'ed',
      status: 'deliberating',
      options: optionsJson,
    })
    .select('id')
    .single();

  if (boardErr) throw boardErr;

  // Dispatch a job for each challenger
  const jobIds: string[] = [];
  for (const name of params.challengers) {
    const exec = EXECUTIVES[name];
    if (!exec) continue;

    // Find agent ID
    const { data: agent } = await sb
      .from('mc_agents')
      .select('id')
      .eq('name', name)
      .single();

    if (!agent) continue;

    const prompt = buildChallengePrompt(exec, params.title, params.context, params.options);

    const { data: job, error: jobErr } = await sb
      .from('mc_jobs')
      .insert({
        title: `Challenge: ${name} on "${params.title}"`,
        prompt_text: prompt,
        repo_path: '/Users/david/.openclaw/workspace/mission-control',
        engine: 'claude',
        status: 'queued',
        priority: 2,
        agent_id: agent.id,
        job_type: 'review',
        source: 'orchestrator',
      })
      .select('id')
      .single();

    if (jobErr) continue;
    jobIds.push(job.id);
  }

  return { board_id: board.id, job_ids: jobIds };
}

/**
 * Record an executive's challenge response.
 */
export async function recordChallengeResponse(
  boardId: string,
  agentName: string,
  response: { position: string; argument: string; risk_flags?: { risk: string; severity: string; mitigation: string }[] },
): Promise<void> {
  const sb = supabaseAdmin();
  const exec = EXECUTIVES[agentName];

  const { data: agent } = await sb
    .from('mc_agents')
    .select('id')
    .eq('name', agentName)
    .single();

  if (!agent) return;

  await sb.from('mc_challenge_responses').insert({
    board_id: boardId,
    agent_id: agent.id,
    perspective: exec?.perspective || 'balanced',
    position: response.position,
    argument: response.argument,
    risk_flags: response.risk_flags || [],
  });
}

/**
 * Synthesise a board's responses into ranked options.
 * Called after all challenger jobs complete.
 */
export async function synthesiseBoard(boardId: string): Promise<BoardSummary | null> {
  const sb = supabaseAdmin();

  const { data: board } = await sb
    .from('mc_challenge_board')
    .select('*')
    .eq('id', boardId)
    .single();

  if (!board) return null;

  const { data: responses } = await sb
    .from('mc_challenge_responses')
    .select('*, mc_agents(name, notes)')
    .eq('board_id', boardId)
    .order('created_at');

  if (!responses?.length) return null;

  // Build enriched options from responses
  const options = (board.options as { label: string; summary: string; recommended_by: string[]; pros: string[]; cons: string[] }[]) || [];

  for (const r of responses) {
    const agentName = (r.mc_agents as { name: string; notes: string } | null)?.name || 'Unknown';
    const agentTitle = (r.mc_agents as { name: string; notes: string } | null)?.notes || '';
    const opt = options.find(o => o.label === r.position);
    if (opt) {
      opt.recommended_by.push(agentName);
      opt.pros.push(`${agentName}: ${r.argument}`);
    }

    // Add risks as cons to other options
    const risks = (r.risk_flags as { risk: string; severity: string; mitigation: string }[]) || [];
    for (const risk of risks) {
      if (risk.severity === 'high') {
        const otherOpts = options.filter(o => o.label === r.position);
        for (const oo of otherOpts) {
          oo.cons.push(`${agentName} flags: ${risk.risk}`);
        }
      }
    }
  }

  // Sort options by number of recommendations (most recommended first)
  options.sort((a, b) => b.recommended_by.length - a.recommended_by.length);

  // Update board with synthesised options
  await sb
    .from('mc_challenge_board')
    .update({ options, status: 'open' })
    .eq('id', boardId);

  return {
    board_id: boardId,
    title: board.decision_title,
    options,
    responses: responses.map(r => ({
      agent_name: (r.mc_agents as { name: string; notes: string } | null)?.name || 'Unknown',
      agent_title: (r.mc_agents as { name: string; notes: string } | null)?.notes || '',
      perspective: r.perspective,
      position: r.position,
      argument: r.argument,
      risk_flags: r.risk_flags as { risk: string; severity: string; mitigation: string }[],
    })),
    status: 'open',
  };
}

/**
 * Record a decision on a challenge board.
 */
export async function recordDecision(
  boardId: string,
  decision: string,
  rationale: string,
): Promise<void> {
  const sb = supabaseAdmin();
  await sb
    .from('mc_challenge_board')
    .update({
      final_decision: decision,
      rationale,
      status: 'decided',
      decided_at: new Date().toISOString(),
    })
    .eq('id', boardId);
}

/**
 * Get open challenge boards for Ed's context.
 */
export async function getOpenBoards(): Promise<BoardSummary[]> {
  const sb = supabaseAdmin();

  const { data: boards } = await sb
    .from('mc_challenge_board')
    .select('*')
    .in('status', ['open', 'deliberating'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (!boards?.length) return [];

  const summaries: BoardSummary[] = [];
  for (const board of boards) {
    const { data: responses } = await sb
      .from('mc_challenge_responses')
      .select('*, mc_agents(name, notes)')
      .eq('board_id', board.id);

    summaries.push({
      board_id: board.id,
      title: board.decision_title,
      options: board.options as BoardSummary['options'],
      responses: (responses || []).map(r => ({
        agent_name: (r.mc_agents as { name: string; notes: string } | null)?.name || 'Unknown',
        agent_title: (r.mc_agents as { name: string; notes: string } | null)?.notes || '',
        perspective: r.perspective,
        position: r.position,
        argument: r.argument,
        risk_flags: r.risk_flags as { risk: string; severity: string; mitigation: string }[],
      })),
      status: board.status,
    });
  }

  return summaries;
}

/**
 * Get recent decisions for learning context.
 */
export async function getRecentDecisions(limit = 5): Promise<{
  title: string;
  decision: string;
  rationale: string;
  decided_at: string;
}[]> {
  const sb = supabaseAdmin();

  const { data } = await sb
    .from('mc_challenge_board')
    .select('decision_title, final_decision, rationale, decided_at')
    .eq('status', 'decided')
    .order('decided_at', { ascending: false })
    .limit(limit);

  return (data || []).map(d => ({
    title: d.decision_title,
    decision: d.final_decision || '',
    rationale: d.rationale || '',
    decided_at: d.decided_at || '',
  }));
}
