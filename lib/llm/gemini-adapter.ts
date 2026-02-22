import { LLMAdapter, LLMTaskOutput } from '@/lib/llm/types';

export class GeminiAdapter implements LLMAdapter {
  async completeStructured(_: { prompt: string; schemaName: string }): Promise<LLMTaskOutput> {
    throw new Error('GeminiAdapter stub: not implemented in MVP');
  }
}
