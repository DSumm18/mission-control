# Mission Control v1 (Next.js + Supabase)

## MVP Setup
1. Copy `.env.example` to `.env.local` and set values.
2. Apply SQL: `supabase/schema.sql` in your Supabase SQL editor.
3. Install deps: `npm install`
4. Run app: `npm run dev`
5. Optional seed migration from legacy `data.json`:
   - `node seeds/seed-from-data-json.mjs`

## Architecture Rules
- No secrets in client.
- LLM calls only via `lib/llm` adapter interface.
- Structured output + Zod validation mandatory.
- Invalid output creates `decisions` item.
- Privileged actions require decision approval.
