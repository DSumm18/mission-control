/**
 * Prompt builders for newsletter research agents (Scout + Hawk).
 * Context: The Schoolgle Signal — weekly newsletter for UK school leaders
 * (heads, SBMs, governors, DSLs).
 */

const SCHOOLGLE_CONTEXT = `You are assessing content for The Schoolgle Signal, a weekly newsletter for UK school leaders (headteachers, school business managers, governors, and designated safeguarding leads). The newsletter is published by Schoolgle and must be practical, evidence-based, and directly useful to its audience. Topics include finance, safeguarding, Ofsted, estates, attendance, SEND, AI policy, and governance.`;

export interface ScoutAssessmentInput {
  title: string;
  sourceUrl: string;
  contentType: string;
  rawContent?: string;
  transcriptText?: string;
  topicHint?: string;
}

export function buildScoutAssessmentPrompt(input: ScoutAssessmentInput): string {
  const contentBlock = input.transcriptText
    ? `TRANSCRIPT:\n${input.transcriptText.slice(0, 8000)}`
    : input.rawContent
      ? `CONTENT:\n${input.rawContent.slice(0, 8000)}`
      : `URL: ${input.sourceUrl}\nFetch and read this URL, then assess it.`;

  return `${SCHOOLGLE_CONTEXT}

TASK: Assess this ${input.contentType} source for newsletter relevance.

TITLE: ${input.title || '(untitled)'}
SOURCE: ${input.sourceUrl}
${input.topicHint ? `TOPIC HINT: ${input.topicHint}` : ''}

${contentBlock}

Respond with ONLY valid JSON matching this structure:
{
  "summary": "2-3 sentence summary of the content",
  "key_points": ["point 1", "point 2", "point 3"],
  "why_relevant": "Why this matters to UK school leaders specifically",
  "relevance_score": <1-10 integer>,
  "newsletter_angle": "Suggested angle for the newsletter — what story would we tell?",
  "topic_area": "<one of: finance|safeguarding|ofsted|estates|attendance|send|ai-policy|governance|other>",
  "agent_assessment": "Your full assessment: strengths, weaknesses, timeliness, how it compares to what we've covered"
}

SCORING GUIDE:
- 9-10: Breaking policy change, major DfE announcement, critical compliance update
- 7-8: Strong practical content, timely topic, clear newsletter angle
- 5-6: Relevant but not urgent, may work as supporting content
- 3-4: Tangentially relevant, low actionability for school leaders
- 1-2: Not relevant to UK education leadership`;
}

export interface HawkDeepDiveInput {
  title: string;
  sourceUrl: string;
  summary: string;
  keyPoints: string[];
  topicArea: string;
  newsletterAngle?: string;
}

export function buildHawkDeepDivePrompt(input: HawkDeepDiveInput): string {
  return `${SCHOOLGLE_CONTEXT}

TASK: Deep-dive analysis of a research item already assessed by Scout.

TITLE: ${input.title}
SOURCE: ${input.sourceUrl}
TOPIC: ${input.topicArea}
SCOUT SUMMARY: ${input.summary}
KEY POINTS: ${input.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}
${input.newsletterAngle ? `SUGGESTED ANGLE: ${input.newsletterAngle}` : ''}

Do a thorough analysis covering:

1. POLICY CONTEXT: What current UK education policy does this relate to? Reference specific DfE guidance, legislation, or Ofsted framework where applicable.

2. CROSS-REFERENCES: What related developments, data, or announcements support or contradict this? Check gov.uk, Ofsted, ESFA, and recent education news.

3. ACTIONABLE IMPLICATIONS: What should a headteacher, SBM, governor, or DSL actually DO with this information? Be specific — not "consider the implications" but "update your safeguarding policy section 4.2 to reflect..."

4. DATA POINTS: Any statistics, thresholds, dates, or figures school leaders need to know.

5. TOOL OPPORTUNITY: Could we build a practical tool (calculator, checker, explorer, dashboard) around this topic?

6. NEWSLETTER RECOMMENDATION: How should this be used in the newsletter? Lead story? Data snapshot? Policy watch? Quick win?

Respond with ONLY valid JSON:
{
  "policy_context": "...",
  "cross_references": ["ref 1", "ref 2"],
  "actionable_implications": ["action 1", "action 2", "action 3"],
  "data_points": ["stat 1", "stat 2"],
  "tool_opportunity": "description or null",
  "recommended_section": "<headline|lead_story|data_snapshot|tool_spotlight|policy_watch|quick_wins>",
  "confidence": <1-10>,
  "full_analysis": "Your complete deep-dive write-up (500-800 words)"
}`;
}
