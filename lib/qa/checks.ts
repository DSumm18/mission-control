import { LLMTaskOutput } from '@/lib/llm/types';

export type QARubricScores = {
  completeness: number;
  accuracy: number;
  actionability: number;
  revenue_relevance: number;
  evidence: number;
};

export function runQAGates(output: LLMTaskOutput) {
  const flags: string[] = [];
  if (!output.summary || output.summary.length < 20) flags.push('completeness_low');
  if (output.riskFlags.length > 0) flags.push('risk_present');
  return { passed: flags.length === 0, flags };
}

/**
 * Score output against the 5-dimension rubric.
 * Returns scores and whether it passes the threshold.
 */
export function scoreRubric(scores: QARubricScores, threshold = 35): {
  total: number;
  passed: boolean;
  scores: QARubricScores;
} {
  const total =
    scores.completeness +
    scores.accuracy +
    scores.actionability +
    scores.revenue_relevance +
    scores.evidence;

  return {
    total,
    passed: total >= threshold,
    scores,
  };
}
