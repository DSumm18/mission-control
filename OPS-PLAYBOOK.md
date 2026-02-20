# OPS-PLAYBOOK.md — How to Use Mission Control

## Quick Start

```bash
cd /Users/david/.openclaw/workspace/mission-control
python3 -m http.server 8899
```

Open **http://localhost:8899** in your browser.

## How to Read the Dashboard

### Sections (top to bottom)

1. **Header** — Shows Ed's current status, autonomy mode, and when data was last updated
2. **Revenue Bar** — £current / £target, products live, days since we started building
3. **David's Action Items** — **This is your TODO list.** Sorted by revenue impact (high → low). These are things only you can do that are blocking products from shipping.
4. **Product Board** — Every product as a card. Colour-coded status. Shows blockers, who owns the blocker, next action, and % complete.
5. **Ed Activity** — What Ed is doing right now, what's queued, what's been done recently
6. **Daily Brief** — Headlines + next actions + a copy-paste ready summary you can send to anyone
7. **Departments** — Click to expand. Shows KPIs for each area.
8. **Opportunity Pipeline** — Research items and potential integrations with source links
9. **Model Router** — Which AI model Ed uses for what task and why
10. **Integrations** — Status of all connected services (green = live, amber = pending, grey = off)
11. **Audit Trail** — Everything that's happened, most recent first. Actor badges: Ed (cyan), David (green), System (grey)

## Status Colours

| Colour | Status | Meaning |
|--------|--------|---------|
| 🔴 Red | `blocked` | Can't progress — needs someone to act |
| 🔵 Cyan | `in-progress` | Ed is actively working on it |
| 🟡 Amber | `ready-to-ship` | Built, needs final approval/action |
| 🟢 Green | `live` | Shipped and running |
| ⚪ Grey | `concept` | Idea stage, not yet started |

## Revenue Impact Badges

- **High** (red) — Directly unblocks revenue or a key product
- **Medium** (amber) — Unblocks a product that's on the path to revenue
- **Low** (grey) — Nice to have, not urgent

## How Ed Updates data.json

Ed updates `data.json` directly — it's the single source of truth. The dashboard auto-refreshes every 60 seconds. Ed will update it:
- When a task is completed
- When a blocker changes
- When new opportunities are found (overnight cron)
- When the daily brief is generated (each morning)

## How to Approve Changes

When David's Action Items show a pending task:
1. Do the thing (e.g., approve a deploy, create an account, provide an API key)
2. Tell Ed it's done (via Telegram)
3. Ed updates data.json — the item moves to "done" and disappears from the panel

## How to Add a New Product

Edit `data.json` → `products` array. Add an object:

```json
{
  "id": "new-product",
  "name": "New Product",
  "owner": "Ed",
  "status": "concept",
  "blocker": null,
  "blockerOwner": null,
  "nextAction": "Define MVP scope",
  "percentComplete": 0,
  "weeklyBet": "What's the hypothesis?",
  "distribution": "Web app"
}
```

Or just tell Ed to add it — he'll update the file.
