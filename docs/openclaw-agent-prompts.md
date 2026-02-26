# OpenClaw Agent Prompts Reference

Migrated from ClawBot gateway cron scheduler. These prompts define agent behavior
and are adapted for MC's job system via mc-scheduler → ag_run.sh.

## Intelligence Agents (Active — Migrate to MC)

### Radar — AI YouTuber Daily Digest
- **Schedule**: Daily 7am (Europe/London)
- **Engine**: claude
- **11 Channels**:
  - Tier 1 (always): AI Search, Matt Maher, AI Samson, Nate B Jones
  - Tier 2 (daily): Matt Wolfe, Riley Brown, Matthew Berman, AI Revolution, Wes Roth, Alex Finn
  - Tier 3 (weekly): Julian Goldie SEO
- **Transcript API**: Supadata (key at `/Users/david/.secrets/supadata_api_key`)
- **Output**: `/Users/david/.openclaw/workspace/memory/ai-digest-YYYY-MM-DD.md`
- **Also**: Creates Notion page under `30912d38-a96f-81a8-8f3f-dbb1511d2e4c`
- **Critical**: Must include Schoolgle newsletter voice angle

### Overnight AI & YouTube Monitor
- **Schedule**: 1am, 4am daily
- **Engine**: claude
- **Focus**: Model releases, AI tools, UK edu tech, viral trends
- **Output**: `/Users/david/.openclaw/workspace/memory/overnight-intel-YYYY-MM-DD.md`

### Scout — Research & Opportunities
- **Schedule**: Every 30m
- **Engine**: claude (has vision)
- **Checks**: `/Users/david/.openclaw/workspace/memory/scout-requests.md`
- **Standards**: `/Users/david/.openclaw/workspace/PM-STANDARDS.md`

### Hawk — Competitive Intelligence
- **Schedule**: Every 12h
- **Engine**: claude (has vision)
- **Monitors**: MyMeme, MySongs, CricBook, ClawPhone competitors
- **Output**: `/Users/david/.openclaw/workspace/memory/hawk-intel.md`

### Pulse — Social Trends
- **Schedule**: Every 12h
- **Engine**: claude (has vision)
- **Platforms**: TikTok, X, Reddit, Instagram, YouTube
- **Output**: `/Users/david/.openclaw/workspace/memory/pulse-trends.md`

### Compass — SEO & ASO
- **Schedule**: Daily
- **Engine**: claude
- **Tracks**: mymeme.uk, mysongs.uk, schoolgle.co.uk, ClawPhone, CricBook
- **Output**: `/Users/david/.openclaw/workspace/memory/compass-seo.md`

### Sentinel — Security Monitor
- **Schedule**: 6am, 12pm, 6pm daily
- **Engine**: claude
- **Checks**: GitHub secrets, server security, Supabase RLS, npm audit, Mac mini hardening

## Product Manager Agents (Disabled — Migrate as needed)

| Agent | Product | Project Path |
|-------|---------|-------------|
| Stumpy | CricBook | `/Users/david/.openclaw/workspace/CricBook/` |
| Principal | DealFind/Schoolgle | `/Users/david/.openclaw/workspace/schoolgle-deal-find/` |
| Pixel | MyMeme | `/Users/david/.openclaw/workspace/my-meme-web/` |
| Melody | MySongs | `/Users/david/.openclaw/workspace/projects/mysongs/` |
| Megaphone | Marketing (cross-product) | — |
| Spike | MyShow | `/Users/david/.openclaw/workspace/myshow/` |
| Chip | ClawPhone | `/Users/david/.openclaw/workspace/clawphone/` |

## Key Paths
- PM Standards: `/Users/david/.openclaw/workspace/PM-STANDARDS.md`
- QA Process: `/Users/david/.openclaw/workspace/QA-PROCESS.md`
- Security Brief: `/Users/david/.openclaw/workspace/SECURITY_AGENT_BRIEF.md`
- Supadata API key: `/Users/david/.secrets/supadata_api_key`
- Notion token: `/Users/david/.secrets/notion_token`
- Notion parent: `30912d38-a96f-81a8-8f3f-dbb1511d2e4c`
