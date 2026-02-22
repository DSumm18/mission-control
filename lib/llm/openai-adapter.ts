import OpenAI from 'openai';
import { LLMAdapter, LLMTaskOutput, LLMTaskOutputSchema } from '@/lib/llm/types';

export class OpenAIAdapter implements LLMAdapter {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async completeStructured(input: { prompt: string; schemaName: string }): Promise<LLMTaskOutput> {
    const run = async () => {
      const res = await this.client.responses.create({
        model: 'gpt-4.1-mini',
        input: `Return strict JSON only for schema ${input.schemaName}.\\nPrompt: ${input.prompt}`
      });
      const text = res.output_text || '{}';
      return LLMTaskOutputSchema.parse(JSON.parse(text));
    };

    try {
      return await run();
    } catch {
      // auto repair retry
      const repaired = await this.client.responses.create({
        model: 'gpt-4.1-mini',
        input: `Repair this to valid JSON for schema ${input.schemaName} and output only JSON.\\n${input.prompt}`
      });
      const text = repaired.output_text || '{}';
      return LLMTaskOutputSchema.parse(JSON.parse(text));
    }
  }
}
