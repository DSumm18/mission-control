import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';

const ReviewBody = z.object({
  newsletter_id: z.string().uuid(),
  reviewer: z.string().min(1).default('Ed'),
  value_for_money_score: z.number().int().min(1).max(10),
  school_relevance_score: z.number().int().min(1).max(10),
  actionability_score: z.number().int().min(1).max(10),
  clarity_score: z.number().int().min(1).max(10),
  differentiation_score: z.number().int().min(1).max(10),
  anti_ai_voice_score: z.number().int().min(1).max(10),
  source_specificity_score: z.number().int().min(1).max(10).default(7),
  source_transparency_score: z.number().int().min(1).max(10).default(7),
  evidence_linking_score: z.number().int().min(1).max(10).default(7),
  tool_viability_score: z.number().int().min(1).max(10).default(7),
  tool_qa_score: z.number().int().min(1).max(10).default(7),
  compliance_confidence_score: z.number().int().min(1).max(10).default(7),
  tool_decision: z.enum(['create_new','adapt_existing','reuse_existing','no_tool']).default('reuse_existing'),
  tool_notes: z.string().optional(),
  strengths: z.string().optional(),
  gaps: z.string().optional(),
  recommendations: z.string().optional(),
});

const PASS_THRESHOLD_V1 = 44;
const PASS_THRESHOLD_V2 = 78;

export async function POST(req: NextRequest) {
  try {
    const body = ReviewBody.parse(await req.json());

    const total_score =
      body.value_for_money_score +
      body.school_relevance_score +
      body.actionability_score +
      body.clarity_score +
      body.differentiation_score +
      body.anti_ai_voice_score;

    const total_score_v2 =
      total_score +
      body.source_specificity_score +
      body.source_transparency_score +
      body.evidence_linking_score +
      body.tool_viability_score +
      body.tool_qa_score +
      body.compliance_confidence_score;

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('mc_newsletter_reviews')
      .insert({
        ...body,
        total_score,
        total_score_v2,
        ready_to_publish: total_score >= PASS_THRESHOLD_V1 && total_score_v2 >= PASS_THRESHOLD_V2,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ review: data, passThreshold: PASS_THRESHOLD_V1, passThresholdV2: PASS_THRESHOLD_V2 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid payload' }, { status: 400 });
  }
}
