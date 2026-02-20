# DEMO-SCENARIO.md — Walkthrough

## Scenario: Adding "Schoolgle OS / PWA" and Watching the Dashboard React

### Step 1: The product exists as a concept

Schoolgle OS / PWA is already in `data.json` with status `concept` and 5% complete. On the dashboard:
- Product Board shows a **grey "concept" badge**
- No blocker shown (it's just an idea)
- Next action: "Validate concept, define MVP scope"

### Step 2: David says "Let's build it — start with auth + dashboard"

Ed updates `data.json`:

```json
{
  "id": "schoolgle-os",
  "name": "Schoolgle OS / PWA",
  "status": "in-progress",         // was: concept
  "blocker": null,
  "blockerOwner": "ed",
  "nextAction": "Build auth flow + teacher dashboard",
  "percentComplete": 10             // was: 5
}
```

**Dashboard changes:**
- Badge turns **cyan** ("in-progress")
- Progress bar moves to 10%
- Ed Activity shows this as current task

### Step 3: Ed hits a blocker — needs Supabase project

```json
{
  "status": "blocked",
  "blocker": "Needs new Supabase project for school data",
  "blockerOwner": "david"
}
```

**Dashboard changes:**
- Badge turns **red** ("blocked")
- Blocker text appears with "Owner: david" badge
- A new item appears in **David's Action Items**: "Create Supabase project for Schoolgle OS" with medium impact

Ed also adds to `davidActions`:
```json
{
  "id": "da-8",
  "action": "Create Supabase project for Schoolgle OS",
  "product": "Schoolgle OS / PWA",
  "revenueImpact": "medium",
  "status": "pending"
}
```

### Step 4: David creates the project, tells Ed

Ed updates:
- `davidActions[da-8].status` → `"done"` (disappears from panel)
- Product blocker → `null`, status → `"in-progress"`
- Adds audit entry: `{ actor: "david", action: "unblocked", target: "Schoolgle OS" }`

### Step 5: Daily Brief reflects everything

Next morning's brief includes:
> "🏫 Schoolgle OS / PWA unblocked — Ed building auth + dashboard"

The copy-paste text updates automatically.

---

This is the full loop: concept → in-progress → blocked → unblocked → shipping. All visible in one dashboard, all driven by a single JSON file.
