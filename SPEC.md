# Mission Control Dashboard — Spec v1

## What Is It?
A single web page you keep open in a browser tab all day. Shows everything at a glance — what's in progress, what's blocked, what Ed is doing, what needs your attention.

**Replaces:** Notion pages you forget to check.

---

## Layout

### 🔴 Revenue Bar (top, always visible)
- Current revenue: £0
- Target: £10K/month
- Days building: 21
- Products live on App Store: 0

### 🟡 Product Board (main area — cards)
Each product as a card:
- **Product name** + one-line status
- **Status badge:** 🔴 Blocked / 🟡 In Progress / 🟢 Ready to Ship / ✅ Live
- **Blocker:** what's stopping it (and who — Ed or David)
- **Next action:** what needs to happen next
- **% complete** estimate

**Products tracked:**
| Product | Current Status |
|---|---|
| MyMeme | 🟡 Security Phase 2 (45 mins, needs David go-ahead) |
| MySongs | 🔴 Blocked (no Suno API key, untested) |
| MyShow | 🔴 Blocked (needs Supabase project + Sync.so validation) |
| ClawPhone | 🔴 Blocked (App Store submission 2+ weeks overdue) |
| DealFind | 🔴 Blocked (needs new Supabase project) |
| CricBook | 🟡 Building in Codex |
| Schoolgle Toolbox | ✅ Live on GitHub Pages (6 tools) |
| Staff Room Newsletter | 🟢 Ready (needs David to create Substack account) |
| Schoolgle OS / PWA | 💡 Concept (spec not started) |

### 🟢 Ed's Activity Feed (right sidebar)
- What Ed is currently doing
- Last 5 completed tasks (with timestamps)
- Queue of upcoming work

### 🔵 David's Action Items (highlighted panel)
Things **only David** can unblock, sorted by revenue impact:
1. Create Substack account → Staff Room launch → first £
2. Approve MyMeme Phase 2 → unlock credit revenue
3. Create MyShow Supabase project → unblock app dev
4. Create DealFind Supabase project → unblock deployment
5. Chase ClawPhone App Store submission

### 📊 Scout Intel Feed (bottom)
- Latest Last 30 Days findings
- Overnight intelligence highlights
- Competitor moves
- Trends spotted

---

## Tech
- **Single HTML file** — self-contained, no dependencies
- **Served locally** on Mac Mini (e.g. port 8899)
- **Auto-refreshes** every 60 seconds
- **Data source:** JSON file that Ed updates (`mission-control/data.json`)
- **Dark theme** matching Schoolgle design system (#070B12, #00D4D4 cyan accents)
- **Mobile responsive** (so David can check on phone too)

## How It Stays Updated
- Ed writes to `data.json` whenever status changes
- Dashboard reads `data.json` on each refresh
- No database needed — just a JSON file on disk

---

## Questions for David
1. Is this the right set of products to track?
2. Anything missing from the layout?
3. Do you want a "quick wins" section showing things that could ship in <1 day?
4. Should the scout feed show full findings or just headlines with links?
5. PWA on the old laptop as a dedicated mission control screen?

---

**Estimated build time:** 2-3 hours for v1
**Ready to build on your approval.**
