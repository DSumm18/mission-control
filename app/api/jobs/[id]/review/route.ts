import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { scoreJob } from '@/lib/org/quality-scorer';

const ReviewBody = z.object({
  reviewer_agent_id: z.string().uuid().nullable().default(null),
  completeness: z.number().int().min(1).max(10),
  accuracy: z.number().int().min(1).max(10),
  actionability: z.number().int().min(1).max(10),
  revenue_relevance: z.number().int().min(1).max(10),
  evidence: z.number().int().min(1).max(10),
  feedback: z.string().min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: jobId } = await ctx.params;

  try {
    const body = ReviewBody.parse(await req.json());

    const result = await scoreJob(
      jobId,
      body.reviewer_agent_id,
      {
        completeness: body.completeness,
        accuracy: body.accuracy,
        actionability: body.actionability,
        revenue_relevance: body.revenue_relevance,
        evidence: body.evidence,
      },
      body.feedback
    );

    return NextResponse.json({ review: result }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
