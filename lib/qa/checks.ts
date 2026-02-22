import { LLMTaskOutput } from '@/lib/llm/types';

export function runQAGates(output: LLMTaskOutput) {
  const flags: string[] = [];
  if (!output.summary || output.summary.length < 20) flags.push('completeness_low');
  if (output.riskFlags.length > 0) flags.push('risk_present');
  return { passed: flags.length === 0, flags };
}
