/**
 * Ed's model router — picks quick-path, Haiku, Sonnet, or Opus based on message content.
 *
 * Tier 1 (quick-path): Supabase-direct answers, no LLM needed (~50ms)
 * Tier 2 (Haiku): Short messages, confirmations, simple questions (~200ms via CLI)
 * Tier 3 (Sonnet): Complex analysis, images, long messages (~500ms via CLI)
 * Tier 4 (Opus): Strategic decisions, architecture, multi-project planning (~2s via CLI)
 *
 * All LLM tiers now use Claude CLI on Max plan — zero cost.
 */

export type ModelTier = 'quick-path' | 'haiku' | 'sonnet' | 'opus';

// CLI model aliases (used directly with --model flag)
const HAIKU_MODEL = 'haiku';
const SONNET_MODEL = 'sonnet';
const OPUS_MODEL = 'opus';

/** Patterns that indicate Opus-tier (strategic/architectural complexity) */
const OPUS_TRIGGERS = [
  /\b(challenge board|strategic decision|project plan|sprint plan|quarterly)\b/i,
  /\b(architecture|redesign|refactor|overhaul)\b/i,
  /\b(business case|roi|budget|financial|revenue strategy)\b/i,
  /\b(risk assessment|compliance|audit)\b/i,
  /\b(multi-project|cross-team|organization|reorg)\b/i,
  /\b(deep (think|analysis|dive|review)|think carefully|take your time)\b/i,
  /\b(full report|comprehensive|detailed plan|roadmap)\b/i,
];

/** Patterns that indicate a Sonnet-tier message */
const SONNET_TRIGGERS = [
  /\b(analy[sz]e|deep dive|strategy|write|draft|plan|compare|evaluate|assess)\b/i,
  /\b(explain in detail|break down|investigate|root cause)\b/i,
  /https?:\/\/\S+/, // URLs need analysis
];

/** Patterns that indicate quick confirmations (Haiku) */
const CONFIRMATION_PATTERNS = [
  /^(yes|no|yep|nah|nope|ok|okay|sure|go|do it|approved?|confirm|reject|deny|cancel)\b/i,
  /^(go ahead|ship it|sounds good|looks good|that works|let's do it|fine)\b/i,
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

/** Patterns that indicate Ed needs to DO something (dispatch, create, build) → always Sonnet+ */
const ACTION_TRIGGERS = [
  /\b(create|build|deploy|dispatch|spawn|queue|fix|launch|ship|push|set up|make|implement)\b/i,
  /\b(repo|repository|sprint|milestone|deadline)\b/i,
  /\b(get .+ (working|done|started|going|built|delivered))\b/i,
  /\b(i want|i need|we need|you need)\b.*\b(to|you)\b/i,
  /\b(progress this|crack on|make it happen|get on with|move on)\b/i,
];

/**
 * Determine which model tier to use for a given message.
 */
export function routeMessage(message: string, hasImages: boolean): ModelTier {
  if (hasImages) return 'sonnet';

  const trimmed = message.trim();

  // Long messages always go to LLM — never quick-path
  // Quick-path is ONLY for short, direct status queries (< 80 chars)
  if (trimmed.length <= 80) {
    for (const pattern of QUICK_PATH_PATTERNS) {
      if (pattern.test(trimmed)) return 'quick-path';
    }
  }

  // Short confirmations → Haiku
  for (const pattern of CONFIRMATION_PATTERNS) {
    if (pattern.test(trimmed)) return 'haiku';
  }

  // Opus triggers — strategic/architectural queries
  for (const pattern of OPUS_TRIGGERS) {
    if (pattern.test(trimmed)) return 'opus';
  }

  // Action triggers → Sonnet (Ed needs to emit MC_ACTION blocks)
  for (const pattern of ACTION_TRIGGERS) {
    if (pattern.test(trimmed)) return 'sonnet';
  }

  // Sonnet triggers (analysis, URLs, etc.)
  for (const pattern of SONNET_TRIGGERS) {
    if (pattern.test(trimmed)) return 'sonnet';
  }

  // Long messages → Sonnet
  if (trimmed.length > 300) return 'sonnet';

  // Default: Haiku for speed
  return 'haiku';
}

/**
 * Get the CLI model alias for a tier.
 */
export function getModelId(tier: ModelTier): string {
  switch (tier) {
    case 'haiku':
      return HAIKU_MODEL;
    case 'sonnet':
      return SONNET_MODEL;
    case 'opus':
      return OPUS_MODEL;
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
    case 'opus':
      return 'opus-4.6';
  }
}
