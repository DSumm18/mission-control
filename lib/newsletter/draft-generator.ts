/**
 * Draft generation orchestration for The Schoolgle Signal.
 * Ed decomposes approved research into newsletter sections,
 * then Megaphone writes each section in Schoolgle voice.
 */

import { NEWSLETTER_SECTIONS } from './section-templates';

export interface ResearchInput {
  id: string;
  title: string;
  summary: string;
  key_points: string[];
  newsletter_angle: string;
  topic_area: string;
  relevance_score: number;
}

export function buildDecompositionPrompt(
  weekNo: number,
  topicCategory: string | null,
  researchItems: ResearchInput[],
): string {
  const itemsList = researchItems
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .map((r, i) => `${i + 1}. [${r.relevance_score}/10] ${r.title}
   Topic: ${r.topic_area}
   Summary: ${r.summary}
   Angle: ${r.newsletter_angle}
   Key points: ${r.key_points.join('; ')}`)
    .join('\n\n');

  const sectionList = NEWSLETTER_SECTIONS
    .map(s => `- ${s.key}: ${s.label} (${s.targetWords[0]}-${s.targetWords[1]} words) — ${s.description}`)
    .join('\n');

  return `You are Ed, the orchestrator for The Schoolgle Signal newsletter (Week ${weekNo}).
Topic focus: ${topicCategory || 'general education'}

APPROVED RESEARCH (${researchItems.length} items, ranked by relevance):
${itemsList}

NEWSLETTER SECTIONS:
${sectionList}

TASK: Decompose this research into newsletter sections. For each section, specify:
1. Which research item(s) to use (by number)
2. The angle/approach for that section
3. Key points to include
4. Word target

The highest-relevance item should typically be the lead story.

Respond with ONLY valid JSON:
{
  "sections": [
    {
      "section_key": "<one of the section keys above>",
      "research_items": [<item numbers>],
      "angle": "how to approach this section",
      "key_points": ["point 1", "point 2"],
      "word_target": <number>
    }
  ],
  "notes": "any overall editorial notes"
}`;
}

export function buildSectionWritePrompt(
  sectionKey: string,
  sectionLabel: string,
  angle: string,
  keyPoints: string[],
  wordTarget: number,
  researchSummaries: string[],
): string {
  return `You are Megaphone, the communications agent for The Schoolgle Signal.

Write the "${sectionLabel}" section for this week's newsletter.

ANGLE: ${angle}
KEY POINTS TO INCLUDE:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

RESEARCH CONTEXT:
${researchSummaries.join('\n---\n')}

WORD TARGET: ${wordTarget} words

VOICE RULES:
- Direct and practical — tell school leaders exactly what to do
- No waffle, no filler, no corporate jargon
- Use "you" not "one" or "stakeholders"
- Short sentences. Active voice. Concrete examples.
- Reference specific UK education context (DfE, Ofsted, ESFA, LAs)
- Feels like a knowledgeable colleague, not a press release
- NEVER use: "In today's rapidly evolving...", "It's important to note...", "Let's delve into...", "Navigating the complexities..."

Respond with ONLY the section content in markdown. No JSON wrapper, no metadata — just the content.`;
}
