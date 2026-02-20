# Demo Scenario — Adding a New Product

## Scenario: Launch "QuizDrop" — an AI quiz generator for teachers

### Step 1: Add to data.json

Open `data.json` and add to the `products` array:

```json
{
  "id": "quizdrop",
  "name": "QuizDrop",
  "url": "quizdrop.uk",
  "status": "IN PROGRESS",
  "percentComplete": 5,
  "currentWork": "Concept + tech spike",
  "blocker": null,
  "blockerType": null,
  "confidence": "Medium",
  "lastTouched": "2026-02-20T11:00:00Z",
  "links": { "repo": "https://github.com/DSumm18/quizdrop" },
  "weeklyBet": {
    "feature": "Generate 10-question quiz from any topic in 5 seconds",
    "distribution": "Staff Room newsletter + teacher Facebook groups",
    "metricTarget": "50 quizzes generated in week 1"
  }
}
```

### Step 2: Add a Job

Add to the `jobs` array:

```json
{
  "id": "j9",
  "title": "QuizDrop MVP Build",
  "product": "quizdrop",
  "owner": "Ed",
  "status": "IN PROGRESS",
  "dependency": null,
  "nextAction": "Build quiz generation API + basic UI",
  "link": null,
  "dueDate": "2026-02-25"
}
```

### Step 3: Update KPIs (if applicable)

If QuizDrop goes live, increment `productsLive`.

### Step 4: Wait 60 seconds

The dashboard polls `data.json` every 60 seconds. The new product card appears on the Products tab, and the job appears on the Jobs tab.

### Step 5: Add Research (optional)

If there's a market signal that prompted QuizDrop, add it to the `research` array with the appropriate pipeline stage.

---

That's the full cycle. No rebuild, no deploy. Edit JSON → wait → it's live on screen.
