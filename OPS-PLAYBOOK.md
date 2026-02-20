# Ops Playbook — Mission Control v2

## How to Run It

1. Open a terminal in the `mission-control` directory
2. Run: `python3 -m http.server 8899`
3. Open: `http://localhost:8899`

That's it. No build step, no dependencies.

## How to Read It

### Company Tab
- **KPI bar** — the four numbers that matter. If MRR is still £0, that's the priority.
- **Department scorecards** — RAG status at a glance. Red means something is stuck. Amber means progress but with blockers.
- **Autonomy Mode** — what Ed can and can't do without your approval.
- **Integrations** — green dot = connected, amber = unknown, red = disconnected.
- **Models & Spend** — which AI model handles which task type. Proposals appear here when Ed wants to change a route.
- **Audit Timeline** — last 20 actions. Check this to see what Ed's been doing.

### Products Tab
- Each card shows status, progress, blocker, confidence, and the weekly bet.
- **Weekly Bet** = the one feature + distribution angle + target metric for the week.
- If a card shows "Blocker: David" — that's on you.

### Jobs Tab
- The work queue. Every job has an owner, status, dependency, and next action.
- If your name is in the Owner column, it's your job.

### Research Tab
- **Daily Brief** — read this first each morning. Three opportunities, three risks, today's focus.
- **Pipeline** — ideas move from Idea → Evidence → Test Plan → Build → Ship.

### Marketing Ops Tab
- Account inventory shows what social accounts exist and their status.
- Content pipeline shows what's drafted, queued, or scheduled.

## How to Edit Products

Edit `data.json` directly. The app polls every 60 seconds.

### Add a New Product

Add an object to the `products` array:

```json
{
  "id": "my-new-product",
  "name": "My New Product",
  "url": "myproduct.com",
  "status": "IN PROGRESS",
  "percentComplete": 10,
  "currentWork": "Building MVP",
  "blocker": null,
  "blockerType": null,
  "confidence": "Medium",
  "lastTouched": "2026-02-20T10:00:00Z",
  "links": { "repo": "https://github.com/DSumm18/my-product" },
  "weeklyBet": {
    "feature": "Core feature description",
    "distribution": "How users find it",
    "metricTarget": "What success looks like"
  }
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| BLOCKED | Needs external unblock (David, third party, etc.) |
| IN PROGRESS | Actively being worked on |
| READY TO SHIP | Done, awaiting final step to go live |
| LIVE | Shipped and available to users |
| PAUSED | On hold, not being worked on |

### % Complete

Rough estimate. Be consistent:
- 0–20% = concept/early build
- 20–50% = core features in progress
- 50–80% = most features done, polish/testing
- 80–95% = nearly ready, final blockers
- 100% = live

## How Ed Updates Data

Ed writes to a temporary file, then renames it to `data.json`. This prevents partial reads. The `lastUpdatedAt` timestamp reflects when Ed last wrote the file.
