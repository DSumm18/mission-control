# Mission Control

## Stack
- Next.js 16 + React 19 + TypeScript + Zod
- Supabase (ref: dybdxegrgofmmlvkthqb) — source of truth for all data
- Tailwind + shadcn/ui for styling
- Vitest for testing
- Hosted on Mac Mini (M4, 16GB) via Cloudflare Tunnel + local Next.js production mode

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Tests: `npx vitest run`
- Type check: `npx tsc --noEmit`

## Architecture
- Ed agent runs via Claude CLI (Max plan, zero cost) — NOT OpenRouter API
- Model tiers: quick-path -> Haiku -> Sonnet -> Opus 4.6 (all via CLI)
- mc-scheduler.mjs = thin poll loop, supports parallel_jobs setting
- ag_run.sh = engine runner (claude/gemini/openai/shell) with proxy fallback
- All execution flows through Supabase jobs — never spawn Claude directly from Telegram

## Key Files
- `.env.local` — all secrets (git-ignored, 600 perms)
- `lib/ed/claude-stream.ts` — Ed CLI backend (spawn claude CLI, stream-json)
- `lib/ed/model-router.ts` — quick-path/haiku/sonnet/opus routing
- `lib/ed/auto-dispatch.ts` — auto-retry, stall detection, agent pause
- `scripts/ag_run.sh` — engine runner
- `scripts/mc-scheduler.mjs` — scheduler
- `scripts/ed-telegram.mjs` — Ed Telegram bridge
- `scripts/ed-heartbeat.mjs` — morning/evening briefings
- `app/api/jobs/run-once/route.ts` — single job execution + auto-dispatch
- `app/api/jobs/run-parallel/route.ts` — parallel job execution

## Launchd Services
- `com.missioncontrol.scheduler` — mc-scheduler.mjs
- `com.missioncontrol.ed-telegram` — Telegram bridge
- `com.missioncontrol.ed-heartbeat` — 08:00/18:00 briefings
- `com.missioncontrol.cloudflared` — Cloudflare Tunnel
- `com.missioncontrol.nextjs` — Next.js production

## Gotchas
- `set -euo pipefail` means empty arrays cause "unbound variable" — use guard
- MCP: use `--mcp-config` (JSON file path), NOT `--mcp-server` (doesn't exist)
- React 19: useRef requires initial value (`useRef<T>(null)`)
- Node v25.6.1: `node -e` with `!` chars gets mangled — write temp .mjs files
- Must unset CLAUDECODE env var for nested CLI calls
- Supabase auth: run-once route uses `x-runner-token` header (NOT Bearer)
- No psql on this machine — use Supabase SQL Editor for DDL
- `CREATE POLICY IF NOT EXISTS` is not valid Postgres — use `DROP IF EXISTS` then `CREATE`

## Rules
- Do NOT build a second assistant framework
- Do NOT recreate OpenClaw
- Do NOT create separate memory outside Supabase
- Do NOT duplicate scheduling outside Mission Control
- Telegram bridge must never spawn Claude directly — all execution via Supabase
