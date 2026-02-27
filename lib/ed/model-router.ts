/**
 * Ed's model router — picks quick-path, Haiku, or Sonnet based on message content.
 *
 * Tier 1 (quick-path): Supabase-direct answers, no LLM needed (~50ms)
 * Tier 2 (Haiku): Short messages, confirmations, simple questions (~200ms)
 * Tier 3 (Sonnet): Complex analysis, images, long messages (~500ms)
 */

export type ModelTier = 'quick-path' | 'haiku' | 'sonnet';

const HAIKU_MODEL = 'anthropic/claude-haiku-4-5-20250929';
const SONNET_MODEL = 'anthropic/claude-sonnet-4-5-20250929';

/** Patterns that indicate a Sonnet-tier message */
const SONNET_TRIGGERS = [
  /\b(analy[sz]e|deep dive|strategy|write|draft|plan|compare|evaluate|assess)\b/i,
  /\b(explain in detail|break down|investigate|root cause)\b/i,
  /https?:\/\/\S+/, // URLs need analysis
];

/** Patterns that indicate quick confirmations (Haiku) */
const CONFIRMATION_PATTERNS = [
  /^(yes|no|yep|nah|nope|ok|okay|sure|go|do it|approved?|confirm|reject|deny|cancel)\b/i,
  /^(go ahead|ship it|sounds good|looks good|that works|let's do it|fine|👍|✅)\b/i,
  /^approve\b/i,
  /^sign off\b/i,
  /^option [a-d]\b/i,
  /^go with\b/i,
];

/** Quick-path trigger patterns — these get answered from Supabase without any LLM */
const QUICK_PATH_PATTERNS = [
  // Jobs
  /\b(jobs?|running|queued|active)\b.*\b(status|what|how|any|running|list)\b/i,
  /\b(status|what|how|any|running|list)\b.*\b(jobs?|running|queued|active)\b/i,
  // Newsletters
  /\bnewsletter\b.*\b(status|latest|current|progress|where)\b/i,
  // Research
  /\bresearch\b.*\b(status|pending|what|list)\b/i,
  // Tasks / decisions
  /\b(tasks?|pending|decisions?|sign.?offs?)\b.*\b(what|list|show|my|pending|open)\b/i,
  /\b(what|show|list)\b.*\b(tasks?|pending|decisions?|sign.?offs?)\b/i,
  /what (do i|should i) need to (do|decide|approve|sign off)/i,
  /what('s| is) (pending|waiting|open)/i,
  // Projects
  /\b(projects?|portfolio)\b.*\b(status|list|show|how|what)\b/i,
  /\b(status|list|show|how|what)\b.*\b(projects?|portfolio)\b/i,
  // Agents
  /\b(agents?|team)\b.*\b(status|list|show|who|active)\b/i,
  /\b(status|list|show|who|active)\b.*\b(agents?|team)\b/i,
  // Challenge boards
  /\b(challenge|board|decision)\b.*\b(status|open|pending|what|show)\b/i,
  // Sitrep / overview
  /\b(sitrep|sit.?rep|situation|overview|what'?s happening|what'?s going on)\b/i,
  // Deployment
  /\b(deploy|deployment|vercel)\b.*\b(status|latest|last|recent)\b/i,
];

/**
 * Determine which model tier to use for a given message.
 */
export function routeMessage(message: string, hasImages: boolean): ModelTier {
  if (hasImages) return 'sonnet';

  const trimmed = message.trim();

  // Check quick-path patterns first
  for (const pattern of QUICK_PATH_PATTERNS) {
    if (pattern.test(trimmed)) return 'quick-path';
  }

  // Short confirmations → Haiku
  for (const pattern of CONFIRMATION_PATTERNS) {
    if (pattern.test(trimmed)) return 'haiku';
  }

  // Sonnet triggers
  for (const pattern of SONNET_TRIGGERS) {
    if (pattern.test(trimmed)) return 'sonnet';
  }

  // Long messages → Sonnet
  if (trimmed.length > 300) return 'sonnet';

  // Default: Haiku for speed
  return 'haiku';
}

/**
 * Get the OpenRouter model ID for a tier.
 */
export function getModelId(tier: ModelTier): string {
  switch (tier) {
    case 'haiku':
      return HAIKU_MODEL;
    case 'sonnet':
      return SONNET_MODEL;
    default:
      return SONNET_MODEL;
  }
}

/**
 * Get display name for model_used field.
 */
export function getModelDisplayName(tier: ModelTier): string {
  switch (tier) {
    case 'quick-path':
      return 'quick-path';
    case 'haiku':
      return 'haiku-4.5';
    case 'sonnet':
      return 'sonnet-4.5';
  }
}
