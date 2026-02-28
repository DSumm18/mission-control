/**
 * Insert master intent + populate all 6 project specs.
 * Run from project root: node scripts/insert-specs.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env from .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) env[match[1]] = match[2];
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Master Intent ────────────────────────────────────────────────────

const masterIntent = {
  business_goals: [
    'Generate £10,000/month combined revenue by end March 2026',
    'Autonomous agent workforce that ships without David\'s constant involvement',
    'Each product to reach first paying customer ASAP',
    'Reduce David to decisions and strategic direction only',
  ],
  revenue_target: '£10,000/month combined by end March 2026',
  priority_order: ['MySongs', 'MyMeme', 'Schoolgle', 'DealFind', 'CricBook', 'ClawPhone'],
  trade_off_hierarchy: [
    'Revenue generation > feature completeness for MVPs',
    'Working payment flow > polished UI',
    'Ship fast > ship perfect — iterate after first revenue',
    'Use existing tools over building new infrastructure',
  ],
  decision_boundaries: {
    agent_autonomy: [
      'Bug fixes and minor improvements',
      'Research and market analysis',
      'Code refactoring (no functionality change)',
      'Newsletter content creation',
      'Creating/updating tasks',
      'Running builds and deploying verified code',
    ],
    escalate_to_david: [
      'New product or major feature decisions',
      'Pricing changes or payment configuration',
      'DB schema changes affecting live data',
      'Any spend over £50/month per service',
      'API key rotation or secrets',
      'Public-facing brand content',
      'Architectural decisions across products',
    ],
  },
  quality_standards: {
    code: ['TypeScript strict — no any', 'Build must pass before commit', 'Follow existing patterns', 'One feature per PR'],
    content: ['Practical, evidence-based', 'No AI-sounding phrases', 'Every claim needs a source'],
    deployment: ['Test locally before push', 'DB migrations via Supabase SQL Editor only'],
  },
  escalation_rules: [
    'Job fails 3x → urgent notification to David',
    'API costs > £50/month for any service → flag immediately',
    'Critical security vulnerability → pause + notify',
    'Agent quality score < 25/50 average → suspend + notify',
    'Product zero progress for 7 days → surface in Ed daily briefing',
  ],
};

// ── Project Specs ────────────────────────────────────────────────────

const projectSpecs = {
  MySongs: {
    overview: 'AI-powered song generator — users describe a song idea, Claude writes lyrics, Suno API generates audio, Stripe handles payment.',
    target_audience: 'Casual music fans who want personalized songs for gifts, events, or fun. Non-musicians.',
    tech_stack: ['Next.js', 'TypeScript', 'Supabase', 'Suno API', 'Stripe', 'Vercel'],
    revenue_model: '£4.99-14.99 per song generation. ~98% margins (Suno API cost ~$0.05/song).',
    current_status: 'No repo yet — needs creating from scratch.',
    key_blockers: ['Repo not created', 'Suno API key needed', 'Stripe account setup'],
    milestones: [
      {
        name: 'App Scaffold',
        target: '2026-03-07',
        status: 'not_started',
        acceptance_criteria: [
          'Next.js app with TypeScript strict mode',
          'Supabase auth (email + Google)',
          'Landing page with value proposition',
          'Basic song request form (description, mood, genre)',
          'Tailwind CSS styling with responsive design',
        ],
        features: ['Landing page', 'Auth flow', 'Song request form', 'User dashboard'],
        constraints: { musts: ['TypeScript strict', 'Supabase for auth and data', 'Mobile-responsive'], must_nots: ['No custom auth system', 'No server-side rendering for auth pages'], preferences: ['Tailwind CSS', 'shadcn/ui components'], escalation: ['If Suno API terms prohibit commercial use'] },
      },
      {
        name: 'Song Generation MVP',
        target: '2026-03-14',
        status: 'not_started',
        acceptance_criteria: [
          'User submits song request → Claude generates lyrics',
          'Lyrics sent to Suno API → audio generated',
          'User can preview and download generated song',
          'Generation status tracking (queued → generating → done)',
          'Error handling for API failures with retry',
        ],
        features: ['Lyric generation via Claude', 'Suno API integration', 'Audio player', 'Download functionality'],
        constraints: { musts: ['Queue-based generation (not blocking)', 'Store generated songs in Supabase Storage'], must_nots: ['No storing API keys client-side'], preferences: ['Show generation progress to user'], escalation: ['If Suno API latency > 60s consistently', 'If Claude lyric quality is poor'] },
      },
      {
        name: 'Payment Integration',
        target: '2026-03-21',
        status: 'not_started',
        acceptance_criteria: [
          'Stripe Checkout for song purchase',
          'Three pricing tiers (basic/standard/premium)',
          'Payment confirmation before generation starts',
          'Receipt email sent after successful payment',
          'Webhook handles payment events reliably',
        ],
        features: ['Stripe Checkout', 'Pricing page', 'Payment webhooks', 'Purchase history'],
        constraints: { musts: ['PCI compliant — use Stripe Checkout, never handle card data', 'Webhook signature verification'], must_nots: ['No custom payment forms', 'No storing card details'], preferences: ['Stripe Customer Portal for subscriptions later'], escalation: ['Pricing decisions', 'Refund policy'] },
      },
    ],
    decomposition_pattern: 'Each milestone is ~1 week. Ship scaffold first, then wire up generation, then payments.',
    evaluation: { build_must_pass: true, test_command: 'npm run build && npm run lint', verify_url: '' },
  },

  MyMeme: {
    overview: 'AI photo style transformation app — users upload a photo, select a style, get a transformed version. Expo/React Native mobile app with Runware API backend.',
    target_audience: 'Social media users, meme creators, anyone wanting fun photo transformations.',
    tech_stack: ['Expo', 'React Native', 'TypeScript', 'Runware API', 'Supabase', 'RevenueCat'],
    revenue_model: 'Freemium — 3 free transforms/day, then in-app purchase packs. £1.99-4.99 per pack.',
    current_status: '127K+ photos processed. App functional but RUNWARE_API_KEY env var broken in production. Payments not wired up.',
    key_blockers: ['RUNWARE_API_KEY env var not loading in production build', 'RevenueCat payment integration incomplete'],
    milestones: [
      {
        name: 'API Key Fix & Payment Integration',
        target: '2026-03-07',
        status: 'not_started',
        acceptance_criteria: ['RUNWARE_API_KEY loads correctly in production EAS build', 'RevenueCat SDK integrated with working subscription flow', 'Free tier enforced (3 transforms/day without payment)', 'Purchase flow tested on TestFlight'],
        features: ['Fix env var loading', 'RevenueCat integration', 'Usage limits', 'Purchase flow'],
        constraints: { musts: ['Keep existing photo processing pipeline working', 'API key must not be bundled in client'], must_nots: ['Do not break existing 127K photo processing flow', 'No custom payment processing'], preferences: ['RevenueCat for cross-platform payments'], escalation: ['If Runware API pricing changes', 'Payment tier pricing decisions'] },
      },
      {
        name: 'App Store Launch',
        target: '2026-03-21',
        status: 'not_started',
        acceptance_criteria: ['App Store listing with screenshots and description', 'Privacy policy and terms of service pages', 'App Review submission passes first attempt', 'Crash-free rate > 99%'],
        features: ['App Store listing', 'Privacy policy', 'Analytics', 'Crash reporting'],
        constraints: { musts: ['Apple App Store Guidelines compliance', 'GDPR compliant photo handling'], must_nots: ['No collecting photos without consent', 'No sharing user photos with third parties'], preferences: ['Sentry for crash reporting'], escalation: ['App Store rejection reasons', 'Legal/privacy concerns'] },
      },
    ],
    decomposition_pattern: 'Fix the blocker first (env var), then payments, then store submission. Sequential dependency.',
    evaluation: { build_must_pass: true, test_command: 'npx expo export', verify_url: '' },
  },

  Schoolgle: {
    overview: 'School management and communication suite for UK schools. Newsletters live, expanding to free tools then paid plans.',
    target_audience: 'UK school administrators, head teachers, marketing leads. 26,500 UK schools.',
    tech_stack: ['Next.js', 'TypeScript', 'Supabase', 'Stripe', 'Vercel'],
    revenue_model: 'SaaS — free tier with tools, paid plans at £1,000-3,000/year per school.',
    current_status: 'Newsletter generator live and functional. Need free tool MVP to drive organic signups.',
    key_blockers: ['No free tool to drive organic traffic', 'No pricing page or payment flow'],
    milestones: [
      {
        name: 'Free Tool MVP',
        target: '2026-03-10',
        status: 'not_started',
        acceptance_criteria: ['At least one free tool live (e.g., school policy generator)', 'Tool captures email for lead generation', 'SEO-optimized landing page for the tool', 'Works without account creation (email capture only)'],
        features: ['Free tool (policy generator or similar)', 'Email capture', 'SEO landing page'],
        constraints: { musts: ['Tool must provide genuine value', 'GDPR compliant email capture'], must_nots: ['No paywall on free tools', 'No requiring full account creation for free tools'], preferences: ['School-specific language and UK education terminology'], escalation: ['Which free tool to build first', 'Data retention policy for captured emails'] },
      },
      {
        name: 'Pricing & Signup Flow',
        target: '2026-03-21',
        status: 'not_started',
        acceptance_criteria: ['Pricing page with 2-3 clear tiers', 'Stripe integration for school subscriptions', 'School onboarding flow (name, type, size)', 'Trial period or demo available'],
        features: ['Pricing page', 'Stripe subscriptions', 'School onboarding', 'Dashboard'],
        constraints: { musts: ['Invoice-friendly (schools need PO numbers)', 'Annual billing option'], must_nots: ['No monthly-only pricing — schools budget annually'], preferences: ['14-day free trial'], escalation: ['Pricing tier decisions', 'Contract/terms for schools'] },
      },
    ],
    decomposition_pattern: 'Free tool first to generate traffic, then pricing page to convert. Newsletter already done.',
    evaluation: { build_must_pass: true, test_command: 'npm run build', verify_url: '' },
  },

  DealFind: {
    overview: 'Deal discovery engine — crawls retailer sites for deals, discounts, and price drops. Commission-based revenue via affiliate links.',
    target_audience: 'UK bargain hunters, deal seekers. Broad consumer market.',
    tech_stack: ['Node.js', 'Crawlee', 'Supabase', 'Next.js', 'TypeScript'],
    revenue_model: 'Affiliate commissions (5-15% per purchase via tracked links). Display ads once traffic builds.',
    current_status: 'V1 scraper pipeline built with Crawlee. Schema needs deploying. No web frontend yet.',
    key_blockers: ['Database schema not deployed to production', 'Scraper stability issues with anti-bot measures', 'No web frontend'],
    milestones: [
      {
        name: 'Schema Deploy & Scraper Stabilisation',
        target: '2026-03-10',
        status: 'not_started',
        acceptance_criteria: ['Database schema deployed to Supabase production', 'Scraper successfully crawls 3+ retailer sites', 'Deals stored with price, URL, category, timestamp', 'Scraper runs on schedule (every 6 hours)', 'Anti-bot countermeasures handled'],
        features: ['Schema deployment', 'Scraper hardening', 'Scheduled runs', 'Deal deduplication'],
        constraints: { musts: ['Respect robots.txt', 'Rate limit requests'], must_nots: ['No scraping behind login walls', 'No storing personal user data from sites'], preferences: ['Residential proxies if needed', 'Start with Amazon, Argos, Currys'], escalation: ['If retailer sends cease & desist', 'Proxy costs > £50/month'] },
      },
      {
        name: 'Web Frontend MVP',
        target: '2026-03-21',
        status: 'not_started',
        acceptance_criteria: ['Next.js frontend showing live deals', 'Category filtering and search', 'Affiliate link tracking', 'Deal cards with price, discount %, retailer, image', 'Mobile responsive'],
        features: ['Deal listing', 'Search & filter', 'Affiliate links', 'Category pages'],
        constraints: { musts: ['Affiliate disclosure (UK ASA compliance)', 'Fast page loads (<2s)'], must_nots: ['No misleading pricing', 'No fake urgency'], preferences: ['SSR for SEO', 'Image optimization'], escalation: ['Affiliate program applications', 'Legal compliance'] },
      },
    ],
    decomposition_pattern: 'Data first (schema + scraper), then frontend. Can\'t show deals without deals.',
    evaluation: { build_must_pass: true, test_command: 'npm run build', verify_url: '' },
  },

  ClawPhone: {
    overview: 'Voice-first iOS app — talk to Claude via phone. Swift native, TestFlight-ready prototype exists.',
    target_audience: 'Power users who want hands-free AI access. Commuters, multitaskers.',
    tech_stack: ['Swift', 'SwiftUI', 'AVFoundation', 'Claude API'],
    revenue_model: 'Subscription — £4.99/month or £39.99/year.',
    current_status: 'TestFlight-ready build exists. Security issue: API key needs rotation.',
    key_blockers: ['API key exposed in build — needs rotation and Keychain storage', 'No payment integration'],
    milestones: [
      {
        name: 'Security Fix (Key Rotation)',
        target: '2026-03-14',
        status: 'not_started',
        acceptance_criteria: ['API key rotated (old key revoked)', 'New key stored in iOS Keychain', 'App communicates via proxy endpoint', 'Build verified on TestFlight'],
        features: ['Key rotation', 'Keychain storage', 'Proxy endpoint', 'Security audit'],
        constraints: { musts: ['Never embed API keys in client code', 'Use server-side proxy'], must_nots: ['No hardcoded secrets', 'No direct API calls from device'], preferences: ['Use Supabase Edge Function as proxy'], escalation: ['If old key was used by unauthorized parties'] },
      },
      {
        name: 'TestFlight Beta',
        target: '2026-03-28',
        status: 'not_started',
        acceptance_criteria: ['TestFlight beta with 10+ external testers', 'Voice → Claude → voice working end-to-end', 'Conversation history persisted locally', 'Battery usage optimized'],
        features: ['External TestFlight', 'Voice pipeline', 'Conversation history', 'Battery optimization'],
        constraints: { musts: ['iOS 17+ minimum', 'Microphone permission handling'], must_nots: ['No recording to server', 'No always-on listening'], preferences: ['Support background audio playback'], escalation: ['TestFlight feedback themes', 'Audio quality issues'] },
      },
    ],
    decomposition_pattern: 'Security fix first (blocking), then TestFlight expansion.',
    evaluation: { build_must_pass: true, test_command: 'xcodebuild -scheme ClawPhone -sdk iphonesimulator build', verify_url: '' },
  },

  CricBook: {
    overview: 'Cricket social network — player profiles, club pages, match scoring. 16K-word spec exists.',
    target_audience: 'Amateur cricket players and clubs in UK. 7,000+ recreational clubs.',
    tech_stack: ['Next.js', 'Expo', 'React Native', 'TypeScript', 'Supabase'],
    revenue_model: 'Freemium club pages. Premium features for clubs (£99-299/year).',
    current_status: 'Detailed spec exists. Monorepo structure planned. No code yet.',
    key_blockers: ['No repo created', 'Spec needs breaking into implementable milestones'],
    milestones: [
      {
        name: 'Player Profile MVP',
        target: '2026-03-21',
        status: 'not_started',
        acceptance_criteria: ['User registration and login', 'Player profile page with stats, bio, photo', 'Cricket-specific stats (batting avg, bowling avg, catches)', 'Profile sharing via URL', 'Mobile responsive'],
        features: ['Auth', 'Player profiles', 'Stats display', 'Profile sharing'],
        constraints: { musts: ['Supabase for all data', 'Mobile-first design'], must_nots: ['No importing stats from external sources yet', 'No real-time scoring in MVP'], preferences: ['Next.js App Router', 'Expo for future mobile'], escalation: ['If cricket stat formats need research'] },
      },
      {
        name: 'Club Pages',
        target: '2026-04-07',
        status: 'not_started',
        acceptance_criteria: ['Club creation and admin management', 'Club page with roster, fixtures, results', 'Players can join clubs', 'Club admin can manage members'],
        features: ['Club CRUD', 'Roster management', 'Fixtures', 'Club feed'],
        constraints: { musts: ['Role-based access', 'Club data owned by admins'], must_nots: ['No payment required for basic club page'], preferences: ['Invite-based club joining'], escalation: ['Club verification process', 'Premium feature decisions'] },
      },
    ],
    decomposition_pattern: 'Player profiles first, then clubs. Community grows from individuals up.',
    evaluation: { build_must_pass: true, test_command: 'npm run build', verify_url: '' },
  },
};

// ── Execute ──────────────────────────────────────────────────────────

async function main() {
  // 1. Insert master intent
  console.log('Inserting master_intent into mc_settings...');
  const { error: intentErr } = await sb
    .from('mc_settings')
    .upsert({ key: 'master_intent', value: masterIntent }, { onConflict: 'key' });

  if (intentErr) {
    console.error('Failed to insert master_intent:', intentErr.message);
  } else {
    console.log('master_intent inserted.');
  }

  // 2. Get all active projects
  const { data: projects, error: projErr } = await sb
    .from('mc_projects')
    .select('id, name, status')
    .eq('status', 'active')
    .order('name');

  if (projErr) {
    console.error('Failed to fetch projects:', projErr.message);
    return;
  }

  console.log(`Found ${projects.length} active projects:`);
  for (const p of projects) {
    console.log(`  - ${p.name} (${p.id})`);
  }

  // 3. Update each project's delivery_plan
  for (const p of projects) {
    const spec = projectSpecs[p.name];
    if (!spec) {
      console.log(`  SKIP: No spec for "${p.name}"`);
      continue;
    }

    const { error: updateErr } = await sb
      .from('mc_projects')
      .update({ delivery_plan: spec, updated_at: new Date().toISOString() })
      .eq('id', p.id);

    if (updateErr) {
      console.error(`  FAIL: ${p.name}: ${updateErr.message}`);
    } else {
      console.log(`  OK: ${p.name} (${spec.milestones.length} milestones)`);
    }
  }

  console.log('Done.');
}

main().catch(console.error);
