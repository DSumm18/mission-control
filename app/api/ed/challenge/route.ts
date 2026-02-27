import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { createChallengeBoard, synthesiseBoard, recordDecision } from '@/lib/ed/challenge-board';

/**
 * GET /api/ed/challenge — List challenge boards
 * Query params: status (open|deliberating|decided|archived), limit
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Number(url.searchParams.get('limit')) || 10;

  const sb = supabaseAdmin();
  let query = sb
    .from('mc_challenge_board')
    .select('*, mc_challenge_responses(*, mc_agents(name, notes, avatar_emoji))')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/ed/challenge — Create or decide on a challenge board
 * Body: { action: 'create' | 'decide' | 'synthesise', ... }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  switch (body.action) {
    case 'create': {
      const result = await createChallengeBoard({
        title: body.title,
        context: body.context,
        options: body.options || [],
        challengers: body.challengers || ['Kate', 'Kerry', 'Nic', 'Helen'],
        projectId: body.project_id,
      });
      return NextResponse.json(result);
    }

    case 'decide': {
      await recordDecision(body.board_id, body.decision, body.rationale || '');
      return NextResponse.json({ ok: true });
    }

    case 'synthesise': {
      const summary = await synthesiseBoard(body.board_id);
      if (!summary) {
        return NextResponse.json({ error: 'Board not found or no responses' }, { status: 404 });
      }
      return NextResponse.json(summary);
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
