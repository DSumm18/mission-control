/**
 * Newsletter section structure for The Schoolgle Signal.
 * Derived from analysing Weeks 1-10 format.
 */

export interface SectionTemplate {
  key: string;
  label: string;
  sortOrder: number;
  description: string;
  targetWords: [number, number]; // [min, max]
  promptHint: string;
}

export const NEWSLETTER_SECTIONS: SectionTemplate[] = [
  {
    key: 'headline',
    label: 'Headline',
    sortOrder: 1,
    description: 'Main attention-grabbing headline for the newsletter',
    targetWords: [5, 15],
    promptHint: 'Write a punchy, specific headline. Not clickbait — factual but compelling. Include the key topic and why it matters NOW.',
  },
  {
    key: 'lead_story',
    label: 'Lead Story',
    sortOrder: 2,
    description: 'Primary article — the main event this week',
    targetWords: [400, 600],
    promptHint: 'Write the lead story in Schoolgle voice. Open with the key fact or change. Explain what it means for schools. Include specific numbers, dates, or thresholds. End with what to do about it.',
  },
  {
    key: 'data_snapshot',
    label: 'Data Snapshot',
    sortOrder: 3,
    description: 'Key data point with context — a number that tells a story',
    targetWords: [80, 150],
    promptHint: 'Pick the most striking data point from this week\'s research. Present it as a headline number with 2-3 sentences of context. Make it visual — this will likely become an infographic.',
  },
  {
    key: 'tool_spotlight',
    label: 'Tool Spotlight',
    sortOrder: 4,
    description: 'This week\'s interactive tool description and link',
    targetWords: [100, 200],
    promptHint: 'Describe this week\'s Schoolgle tool. What does it do? Who should use it? One specific example of how. Include a call to action.',
  },
  {
    key: 'policy_watch',
    label: 'Policy Watch',
    sortOrder: 5,
    description: 'Policy or regulatory update school leaders need to know',
    targetWords: [150, 300],
    promptHint: 'Summarise the policy development. Link to the source document. Explain the practical impact — what changes for schools? Include compliance deadlines if any.',
  },
  {
    key: 'quick_wins',
    label: 'Quick Wins',
    sortOrder: 6,
    description: '3-5 actionable bullets school leaders can act on this week',
    targetWords: [100, 200],
    promptHint: 'Write 3-5 bullet points. Each must be a specific action someone can take THIS WEEK. Start each with a verb. Be concrete — not "review your policies" but "check your KCSIE Part One briefing covers the new online safety additions".',
  },
  {
    key: 'week_ahead',
    label: 'Week Ahead',
    sortOrder: 7,
    description: 'What\'s coming next week — dates, deadlines, events',
    targetWords: [80, 150],
    promptHint: 'List key dates, deadlines, and events for the coming week relevant to school leaders. Include DfE consultations closing, Ofsted inspection windows, ESFA submission dates, term dates.',
  },
  {
    key: 'snippet_preview',
    label: 'Snippet Preview',
    sortOrder: 8,
    description: 'Teaser for the interactive snippet embedded in the newsletter',
    targetWords: [40, 80],
    promptHint: 'Write a 1-2 sentence teaser for the interactive snippet. Make it clear what the reader will get if they click through. Create curiosity without being vague.',
  },
];

export function getSectionByKey(key: string): SectionTemplate | undefined {
  return NEWSLETTER_SECTIONS.find(s => s.key === key);
}

export function getSectionKeys(): string[] {
  return NEWSLETTER_SECTIONS.map(s => s.key);
}
