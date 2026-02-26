/**
 * Inspector voice-check prompts for Schoolgle Signal newsletter drafts.
 * Ensures content sounds human, direct, and practical — not AI-generated.
 */

export interface VoiceCheckInput {
  weekNo: number;
  draftVersion: number;
  fullMarkdown: string;
  sectionKey?: string;
}

export function buildVoiceCheckPrompt(input: VoiceCheckInput): string {
  return `You are the Inspector agent for The Schoolgle Signal (Week ${input.weekNo}, draft v${input.draftVersion}).

Your job: check this newsletter draft for AI-sounding language and ensure it matches the Schoolgle voice.

${input.sectionKey ? `SECTION: ${input.sectionKey}` : 'FULL DRAFT'}

CONTENT:
${input.fullMarkdown.slice(0, 12000)}

THE SCHOOLGLE VOICE:
- Direct and practical — tells school leaders exactly what to do
- No waffle, no filler, no corporate jargon
- Uses "you" not "one" or "stakeholders"
- Short sentences. Active voice. Concrete examples.
- References specific UK education context (DfE, Ofsted, ESFA, LAs)
- Feels like a knowledgeable colleague, not a press release

FLAG THESE AI TELLS:
- "In today's rapidly evolving..." / "In an era of..."
- "It's important to note that..." / "It's worth noting..."
- "Navigating the complexities of..."
- "Leveraging" / "Harnessing" / "Pivotal"
- "This comprehensive guide..." / "Let's delve into..."
- "Moving forward" / "At the end of the day"
- Excessive hedging ("may", "could potentially", "it might be worth considering")
- Bullet lists that all start the same way
- Paragraphs that summarise what was just said
- Any sentence that could apply to any topic (not education-specific)

Respond with ONLY valid JSON:
{
  "anti_ai_voice_score": <1-10, where 10 is perfectly human>,
  "flagged_phrases": [
    {"phrase": "exact phrase found", "line_hint": "first few words of the line", "suggestion": "rewrite suggestion"}
  ],
  "rewrite_suggestions": [
    {"original": "original sentence", "rewrite": "improved version in Schoolgle voice"}
  ],
  "overall_notes": "Brief assessment of voice quality",
  "pass": <true if score >= 7>
}`;
}
