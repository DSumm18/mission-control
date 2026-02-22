import { z } from 'zod';

export const LLMTaskOutputSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([])
});

export type LLMTaskOutput = z.infer<typeof LLMTaskOutputSchema>;

export interface LLMAdapter {
  completeStructured(input: { prompt: string; schemaName: string }): Promise<LLMTaskOutput>;
}
