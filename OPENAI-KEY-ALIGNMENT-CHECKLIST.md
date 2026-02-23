# Mission Control — OpenAI Key Alignment Checklist

## Goal
Resolve OpenAI 401 for Mission Control without exposing secrets.

## Current status
- Dev server: UP (`localhost:3000`)
- Direct OpenAI ping: FAIL (401)

## Fix steps
1. In OpenAI dashboard, switch to **Default project** (same project as usage screenshot).
2. Create a **new API key** in that project.
3. Update `mission-control/.env.local`:
   - replace only `OPENAI_API_KEY=...`
4. Fully stop dev server (`pkill -f 'next dev'`).
5. Restart dev server (`npm run dev` in `mission-control`).
6. Run direct ping test (no router abstraction).

## Pass criteria
- OpenAI ping returns HTTP 200
- Mission Control LLM smoke test = SUCCESS

## If still failing
- Ensure key belongs to correct project (not org-level mismatch)
- Ensure no hidden whitespace/newline in key line
- Reissue key again in the correct project and retry
