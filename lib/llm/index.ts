import { OpenAIAdapter } from '@/lib/llm/openai-adapter';
import { LLMAdapter } from '@/lib/llm/types';

export function getLLMAdapter(): LLMAdapter {
  return new OpenAIAdapter();
}
