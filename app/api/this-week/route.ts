import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

export async function GET() {
  const sb = supabaseAdmin();

  // Current in-progress newsletters (not yet published)
  const { data: pipeline } = await sb
    .from('mc_v_current_pipeline')
    .select('*');

  // Research items needing attention
  const { data: researchItems } = await sb
    .from('mc_research_items')
    .select('id, title, status, relevance_score, content_type, topic_area, created_at')
    .in('status', ['captured', 'assessed'])
    .order('created_at', { ascending: false })
    .limit(20);

  // Research counts by status
  const { data: allResearch } = await sb
    .from('mc_research_items')
    .select('status, approved_for_draft');

  const researchCounts = {
    total: allResearch?.length || 0,
    captured: allResearch?.filter(r => r.status === 'captured').length || 0,
    assessed: allResearch?.filter(r => r.status === 'assessed').length || 0,
    approved: allResearch?.filter(r => r.status === 'approved').length || 0,
    rejected: allResearch?.filter(r => r.status === 'rejected').length || 0,
  };

  // Latest drafts needing review
  const { data: drafts } = await sb
    .from('mc_newsletter_drafts')
    .select('id, newsletter_id, version, status, voice_check_score, created_at')
    .in('status', ['draft', 'reviewing'])
    .order('created_at', { ascending: false })
    .limit(5);

  // Recent newsletter-related jobs (last 10 completed)
  const { data: recentJobs } = await sb
    .from('mc_jobs')
    .select('id, title, status, engine, agent_id, completed_at, result_json')
    .in('command', [
      'research_assessment', 'youtube_transcript', 'deep_dive',
      'draft_decompose', 'write_section', 'voice_check', 'qa_review',
      'build_tool', 'deploy_newsletter', 'social_copy',
    ])
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(5);

  // Enrich jobs with agent info
  const agentIds = [...new Set((recentJobs || []).map(j => j.agent_id).filter(Boolean))];
  let agentMap: Record<string, { name: string; avatar_emoji: string }> = {};
  if (agentIds.length > 0) {
    const { data: agents } = await sb
      .from('mc_agents')
      .select('id, name, avatar_emoji')
      .in('id', agentIds);
    for (const a of agents || []) {
      agentMap[a.id] = { name: a.name, avatar_emoji: a.avatar_emoji };
    }
  }

  const enrichedJobs = (recentJobs || []).map(j => ({
    ...j,
    agent_name: j.agent_id ? agentMap[j.agent_id]?.name : null,
    agent_emoji: j.agent_id ? agentMap[j.agent_id]?.avatar_emoji : null,
  }));

  // Needs attention counts
  const needsAttention = {
    research_awaiting_approval: researchCounts.assessed,
    research_new: researchCounts.captured,
    drafts_awaiting_review: drafts?.filter(d => d.status === 'draft').length || 0,
    drafts_in_review: drafts?.filter(d => d.status === 'reviewing').length || 0,
  };

  return NextResponse.json({
    pipeline: pipeline || [],
    research: researchItems || [],
    researchCounts,
    drafts: drafts || [],
    recentJobs: enrichedJobs,
    needsAttention,
  });
}
