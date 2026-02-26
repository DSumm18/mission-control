import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { decomposeJob } from '@/lib/org/decomposer';

const SubTaskSchema = z.object({
  title: z.string().min(1),
  suggested_agent: z.string().min(1),
  priority: z.number().int().min(1).max(10).default(5),
  estimated_engine: z.enum(['claude', 'shell']).default('claude'),
  prompt_text: z.string().min(1),
});

const DecomposeBody = z.object({
  sub_tasks: z.array(SubTaskSchema).min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: jobId } = await ctx.params;

  try {
    const body = DecomposeBody.parse(await req.json());
    const result = await decomposeJob(jobId, body.sub_tasks);
    return NextResponse.json({ decomposition: result }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
