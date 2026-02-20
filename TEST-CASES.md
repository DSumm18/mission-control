# Mission Control v2.0 — Test Cases

**Document:** TEST-CASES.md  
**Author:** QA Tester (Independent)  
**Date:** 2026-02-17  
**Spec Reference:** SPEC.md v2.0  

---

## 1. Header Bar

### TC-MC-001: Header renders with all elements
- **Precondition:** App running on localhost:3000
- **Steps:** Navigate to `/`
- **Expected Result:** Logo, "MISSION CONTROL" text (JetBrains Mono, uppercase), live clock (HH:MM:SS GMT), status dot, refresh timer ("Last sync: Xs ago"), nav tabs (Overview, Gates, Builds, Issues, Audit) all visible. Header is fixed top, h-14, bg-slate-950/90 with backdrop-blur.
- **Pass/Fail:** ☐

### TC-MC-002: Live clock updates every second
- **Precondition:** Dashboard loaded
- **Steps:** Observe clock for 5 seconds
- **Expected Result:** Clock increments every second in HH:MM:SS GMT format.
- **Pass/Fail:** ☐

### TC-MC-003: Status dot reflects system health
- **Precondition:** PRODUCT-STATUS.json loaded with mixed health values
- **Steps:** 1) Set all products health to "green" → reload. 2) Set one to "yellow" → reload. 3) Set one to "red" → reload.
- **Expected Result:** 1) Green pulsing dot. 2) Yellow dot. 3) Red dot. Worst health wins.
- **Pass/Fail:** ☐

### TC-MC-004: Nav tab switching
- **Precondition:** Dashboard loaded
- **Steps:** Click each nav tab: Overview, Gates, Builds, Issues, Audit
- **Expected Result:** Each navigates to the correct page. Active tab shows `text-cyan-400 border-b-2 border-cyan-400`.
- **Pass/Fail:** ☐

### TC-MC-005: Refresh timer resets on SWR revalidation
- **Precondition:** Dashboard loaded
- **Steps:** Wait 10+ seconds, observe "Last sync" timer counting up, then trigger manual refresh
- **Expected Result:** Timer resets to "0s ago" on refresh.
- **Pass/Fail:** ☐

---

## 2. Gate Tracker Panel

### TC-MC-010: Gate tracker renders all modules G1-G5
- **Precondition:** GATE-TRACKER.json contains ≥10 modules at various stages
- **Steps:** Navigate to Overview, locate Gate Tracker panel
- **Expected Result:** Table shows every module with columns: Module, G1, G2, G3, G4, G5, Docs, Status. Each gate shows correct icon: ● passed (emerald), ◐ in-progress (amber, pulsing), ○ locked (slate), ✕ failed (red).
- **Pass/Fail:** ☐

### TC-MC-011: Docs column shows correct count and tooltip
- **Precondition:** Module with 2/4 docs present
- **Steps:** Hover over the "2/4" docs indicator
- **Expected Result:** Tooltip shows which docs exist (✓) and which are missing (✗): RESEARCH.md, SPEC.md, TEST-CASES.md, QA-REPORT.md. Text is red if any missing and gate ≥ G4.
- **Pass/Fail:** ☐

### TC-MC-012: Filter dropdown works
- **Precondition:** Modules in various states (complete, in-progress, blocked)
- **Steps:** Use filter dropdown: All, In Progress, Blocked, Complete
- **Expected Result:** Table filters to show only matching modules. "All" shows everything.
- **Pass/Fail:** ☐

### TC-MC-013: Click module row opens drill-down panel
- **Precondition:** Gate tracker rendered with data
- **Steps:** Click on "Safeguarding Hub" row
- **Expected Result:** Slide-out panel appears showing: all 4 doc statuses with rendered markdown, gate history timeline, build history for that module.
- **Pass/Fail:** ☐

### TC-MC-014: Click gate icon shows gate detail
- **Precondition:** Module with a passed gate (e.g. G2 passed)
- **Steps:** Click the G2 ● icon for Safeguarding
- **Expected Result:** Popover/detail shows approver name, approval date, and any notes.
- **Pass/Fail:** ☐

### TC-MC-015: Release gate blocking — cannot pass G5 without all docs
- **Precondition:** Module at G4 with docs missing (e.g. 2/4)
- **Steps:** Verify G5 status for this module
- **Expected Result:** G5 shows a red lock icon. `releaseBlocked: true` displayed. `blockReason` text visible (e.g. "Missing TEST-CASES.md, QA-REPORT.md"). Module status column shows 🔴.
- **Pass/Fail:** ☐

### TC-MC-016: Release gate passes when all docs present and G1-G4 passed
- **Precondition:** Module with all 4 docs, G1-G4 all "passed"
- **Steps:** Verify G5 status
- **Expected Result:** G5 is either "passed" ● or "in-progress" ◐ — NOT locked with a red lock. `releaseBlocked: false`. Status shows 🟢.
- **Pass/Fail:** ☐

### TC-MC-017: Documentation links navigate correctly
- **Precondition:** Module drill-down open
- **Steps:** Click on each doc link: RESEARCH.md, SPEC.md, TEST-CASES.md, QA-REPORT.md
- **Expected Result:** Each fetches content from `/api/docs/[moduleId]/[docName]` and renders markdown. Missing docs show placeholder "Document not yet created".
- **Pass/Fail:** ☐

---

## 3. Build Log Panel

### TC-MC-020: Build log shows last 20 builds
- **Precondition:** BUILD-LOG.json with >20 entries
- **Steps:** View Build Log on Overview page
- **Expected Result:** Table shows 20 rows with columns: Time, Module, Tool, Result, Category, Duration. PASS in emerald, FAIL in red. Failure category as coloured pill.
- **Pass/Fail:** ☐

### TC-MC-021: Build summary bar displays correct stats
- **Precondition:** Mix of pass/fail builds today
- **Steps:** Check summary bar above build table
- **Expected Result:** Shows "Today: X builds · Y pass · Z fail · N% success rate" with mini sparkline.
- **Pass/Fail:** ☐

### TC-MC-022: Failure breakdown pie chart renders
- **Precondition:** Builds with different failure categories (spec, tool, resource, auth, test, unknown)
- **Steps:** View Build Log panel
- **Expected Result:** Recharts PieChart shows distribution of failure categories with correct colours.
- **Pass/Fail:** ☐

### TC-MC-023: Click build row expands detail
- **Precondition:** Build log rendered
- **Steps:** Click on a failed build row
- **Expected Result:** Row expands inline showing: full error detail (`failureDetail`), commit hash, agent name, gate.
- **Pass/Fail:** ☐

### TC-MC-024: Build log filter works
- **Precondition:** Builds from multiple modules
- **Steps:** Use filter dropdown to filter by module or result
- **Expected Result:** Table updates to show only matching builds.
- **Pass/Fail:** ☐

### TC-MC-025: Full build log page (Builds tab)
- **Precondition:** Dashboard loaded
- **Steps:** Click "Full Log →" link or Builds nav tab
- **Expected Result:** Navigates to `/builds` showing full paginated build history with all filters.
- **Pass/Fail:** ☐

---

## 4. Team Activity (Right Sidebar)

### TC-MC-030: Team activity shows all agents
- **Precondition:** TEAM-STATUS.json with 3 agents (2 running, 1 idle)
- **Steps:** View Team Activity in right sidebar
- **Expected Result:** Shows count "3 active". Each agent shows: status indicator (● green pulse for running, ○ slate for idle), name, last seen time, current task, module, last output snippet.
- **Pass/Fail:** ☐

### TC-MC-031: Agent status indicators are correct
- **Precondition:** Agents in states: running, idle, waiting, error
- **Steps:** Verify each agent's visual indicator
- **Expected Result:** Running = green pulse ●, Waiting = amber ◐, Idle = slate ○, Error = red ✕.
- **Pass/Fail:** ☐

---

## 5. Revenue Tracker

### TC-MC-040: Revenue stats display correctly
- **Precondition:** REVENUE.json with target £10,000, current £0
- **Steps:** View Revenue Tracker
- **Expected Result:** Shows: Current Month Revenue (£0), Target (£10,000), Daily Needed (calculated), Days Left (calculated from deadline). Progress bar at 0%.
- **Pass/Fail:** ☐

### TC-MC-041: Revenue chart renders with Recharts
- **Precondition:** REVENUE.json with daily data
- **Steps:** View Revenue Tracker right half
- **Expected Result:** Recharts AreaChart visible. Solid line = actual revenue. Dashed line = target pace. X-axis = dates, Y-axis = £ amounts.
- **Pass/Fail:** ☐

### TC-MC-042: Revenue breakdown by product
- **Precondition:** Revenue data with per-product breakdown
- **Steps:** Check below the chart
- **Expected Result:** Horizontal bar chart or pill badges showing revenue per product.
- **Pass/Fail:** ☐

### TC-MC-043: Revenue progress bar styling
- **Precondition:** Revenue at various levels
- **Steps:** Set revenue to 50% of target, reload
- **Expected Result:** Progress bar fills ~50% with gradient `from-cyan-500 to-emerald-500`. Numbers in `text-3xl font-mono text-white`.
- **Pass/Fail:** ☐

---

## 6. Product Status Cards

### TC-MC-050: Product grid renders all 7 products
- **Precondition:** PRODUCT-STATUS.json with all 7 products
- **Steps:** View Product Status grid
- **Expected Result:** 7 cards in 3-column grid. Each shows: name, status badge (colour-coded), revenue vs target, users count, health dot, blockers list, last deploy relative time.
- **Pass/Fail:** ☐

### TC-MC-051: Status badge colours match spec
- **Precondition:** Products in various statuses
- **Steps:** Verify badge colours
- **Expected Result:** Planning=slate, In Development=blue, Beta=amber, Live=emerald, Paused=red (all using bg-X-900 text-X-300 pattern).
- **Pass/Fail:** ☐

### TC-MC-052: Click product card opens detail
- **Precondition:** Product cards rendered
- **Steps:** Click MyMeme card
- **Expected Result:** Product detail page/panel opens showing full metrics, deploy history, revenue chart.
- **Pass/Fail:** ☐

---

## 7. Task Overview (Right Sidebar)

### TC-MC-060: Task overview shows summary and list
- **Precondition:** Tasks exist (overdue, in-progress, done)
- **Steps:** View Task Overview in sidebar
- **Expected Result:** Header shows total count. Summary: "X overdue · Y in progress · Z done". List sorted by priority (HIGH 🔴, MED 🟡, LOW 🟢) with assignee and due date. Overflow shows "[+ N more tasks →]".
- **Pass/Fail:** ☐

---

## 8. Issue Tracker (Right Sidebar)

### TC-MC-070: Issue tracker shows open issues
- **Precondition:** ISSUES.json with 4 open issues at different severities
- **Steps:** View Issue Tracker in sidebar
- **Expected Result:** Header: "4 open". Breakdown: "X critical · Y high · Z medium". Issues listed with severity icon, ID, title, product, assignee, age. Trend indicator (+/- vs last week).
- **Pass/Fail:** ☐

### TC-MC-071: Full issues page
- **Precondition:** Dashboard loaded
- **Steps:** Click "View all issues →" or Issues nav tab
- **Expected Result:** Navigates to `/issues` with full filterable list (status, severity, product).
- **Pass/Fail:** ☐

---

## 9. Audit Trail

### TC-MC-080: Audit trail renders timestamped entries
- **Precondition:** AUDIT-LOG.jsonl with 30+ entries of various types
- **Steps:** View Audit Trail on Overview page
- **Expected Result:** Live feed shows entries with: time (HH:MM), type icon (🏗️ build, ✅ test, 🚪 gate, etc.), module, actor, detail. Newest entries at top.
- **Pass/Fail:** ☐

### TC-MC-081: Audit trail search (full-text)
- **Precondition:** Audit entries with various text
- **Steps:** Type "safeguarding" in search box
- **Expected Result:** Only entries containing "safeguarding" are shown. Search is case-insensitive.
- **Pass/Fail:** ☐

### TC-MC-082: Audit trail filter by type
- **Precondition:** Entries of types: gate_approval, build, test, deploy, issue_created, etc.
- **Steps:** Select "build" from filter dropdown
- **Expected Result:** Only build-type entries shown.
- **Pass/Fail:** ☐

### TC-MC-083: Audit trail pagination
- **Precondition:** AUDIT-LOG.jsonl with 200+ entries
- **Steps:** Scroll to bottom of audit trail, click "Load more" or paginate
- **Expected Result:** API called with offset parameter. Next batch of entries loaded. No duplicates, correct chronological order.
- **Pass/Fail:** ☐

### TC-MC-084: Audit trail auto-scroll for new entries
- **Precondition:** Audit trail visible, SWR auto-refreshing
- **Steps:** Add new entry to AUDIT-LOG.jsonl, wait for refresh
- **Expected Result:** New entry appears at top with subtle flash animation.
- **Pass/Fail:** ☐

### TC-MC-085: Full audit page
- **Precondition:** Dashboard loaded
- **Steps:** Click Audit nav tab
- **Expected Result:** Navigates to `/audit` with full paginated, searchable, filterable audit log.
- **Pass/Fail:** ☐

---

## 10. Ed Chat Widget

### TC-MC-090: Ed Chat renders in sidebar
- **Precondition:** Dashboard loaded
- **Steps:** Locate Ed Chat at bottom of right sidebar
- **Expected Result:** Chat panel visible with header "💬 ED CHAT", collapse button [−], input field "Type a command...", Send button.
- **Pass/Fail:** ☐

### TC-MC-091: Send message and receive response
- **Precondition:** Ed API running on localhost:18789
- **Steps:** Type "status safeguarding" and click Send (or press Enter)
- **Expected Result:** User message appears in chat. POST to `/api/chat` fires. Response streams back and displays in chat.
- **Pass/Fail:** ☐

### TC-MC-092: Chat collapse/expand
- **Precondition:** Ed Chat visible
- **Steps:** Click [−] button
- **Expected Result:** Chat collapses to just header bar. Click again to expand.
- **Pass/Fail:** ☐

### TC-MC-093: Chat with Ed API unavailable
- **Precondition:** Ed API not running / unreachable
- **Steps:** Send a message
- **Expected Result:** Graceful error message in chat (e.g. "Ed is unavailable right now"). No crash.
- **Pass/Fail:** ☐

---

## 11. Dark Theme

### TC-MC-100: Consistent dark theme across all panels
- **Precondition:** Dashboard fully loaded
- **Steps:** Visual inspection of all panels
- **Expected Result:** Background: slate-950 (#020617). Surfaces: slate-900/50 with backdrop-blur. Borders: slate-800. Text: slate-100 primary, slate-400 secondary. No white backgrounds, no light-theme leaks. Cards use consistent styling.
- **Pass/Fail:** ☐

### TC-MC-101: Accent colours used correctly
- **Precondition:** Dashboard with mixed data states
- **Steps:** Verify colour usage throughout
- **Expected Result:** Cyan for links/active states, Emerald for success/pass, Amber for warnings/in-progress, Red for errors/fail, Blue for info/dev. Consistent everywhere.
- **Pass/Fail:** ☐

---

## 12. Real-Time Refresh

### TC-MC-110: SWR auto-revalidation at correct intervals
- **Precondition:** Dashboard loaded, network tab open
- **Steps:** Monitor API calls for 60 seconds
- **Expected Result:** Gates/Team/Audit refresh every ~10s. Builds/Products/Tasks/Issues every ~30s. Revenue every ~60s.
- **Pass/Fail:** ☐

### TC-MC-111: Revalidate on tab focus
- **Precondition:** Dashboard loaded
- **Steps:** Switch to another tab, wait 30s, switch back
- **Expected Result:** All data endpoints hit on tab return. "Last sync" resets.
- **Pass/Fail:** ☐

### TC-MC-112: Manual refresh button
- **Precondition:** Dashboard loaded
- **Steps:** Click refresh button in header
- **Expected Result:** All data endpoints called. "Last sync" resets. Data updates if underlying files changed.
- **Pass/Fail:** ☐

---

## 13. Responsive Design

### TC-MC-120: Desktop ≥1440px layout
- **Precondition:** Browser at 1440px+ width
- **Steps:** Verify layout
- **Expected Result:** Full layout: main content area + 320px right sidebar. All panels visible as per spec layout diagram.
- **Pass/Fail:** ☐

### TC-MC-121: Tablet 1024–1439px layout
- **Precondition:** Browser at 1200px width
- **Steps:** Verify layout
- **Expected Result:** Sidebar collapses to bottom section. Main grid is 2-column.
- **Pass/Fail:** ☐

### TC-MC-122: Small tablet 768–1023px layout
- **Precondition:** Browser at 800px width
- **Steps:** Verify layout
- **Expected Result:** Single column. Sidebar panels inline with main content.
- **Pass/Fail:** ☐

### TC-MC-123: Mobile <768px layout
- **Precondition:** Browser at 375px width
- **Steps:** Verify layout
- **Expected Result:** Full mobile stack. Ed Chat becomes floating button (not inline sidebar panel).
- **Pass/Fail:** ☐

---

## 14. API Routes

### TC-MC-130: API returns empty/default data when file missing
- **Precondition:** Remove GATE-TRACKER.json (or rename it)
- **Steps:** Call `GET /api/gates`
- **Expected Result:** Returns valid JSON with empty/default structure (NOT a 500 error). Dashboard renders gracefully with "no data" state.
- **Pass/Fail:** ☐

### TC-MC-131: API error response format
- **Precondition:** Corrupt a JSON source file
- **Steps:** Call the associated API endpoint
- **Expected Result:** Returns `{ error: string, status: number }` with appropriate HTTP status code.
- **Pass/Fail:** ☐

### TC-MC-132: Audit API pagination params
- **Precondition:** AUDIT-LOG.jsonl with 100+ entries
- **Steps:** Call `GET /api/audit?limit=10&offset=0`, then `GET /api/audit?limit=10&offset=10`
- **Expected Result:** First call returns entries 1-10, second returns 11-20. No overlap. Correct total count in response.
- **Pass/Fail:** ☐

### TC-MC-133: Audit API search param
- **Precondition:** Audit log with varied entries
- **Steps:** Call `GET /api/audit?search=safeguarding`
- **Expected Result:** Only entries matching "safeguarding" returned.
- **Pass/Fail:** ☐

### TC-MC-134: Audit API filter by type
- **Precondition:** Audit log with multiple event types
- **Steps:** Call `GET /api/audit?type=build`
- **Expected Result:** Only build-type entries returned.
- **Pass/Fail:** ☐

### TC-MC-135: Builds API pagination and filters
- **Precondition:** BUILD-LOG.json with 50+ builds
- **Steps:** Call `GET /api/builds?limit=10&module=safeguarding&result=fail`
- **Expected Result:** Returns max 10 failed builds for safeguarding module only.
- **Pass/Fail:** ☐

### TC-MC-136: Issues API filters
- **Precondition:** ISSUES.json with varied issues
- **Steps:** Call `GET /api/issues?status=open&severity=critical`
- **Expected Result:** Only open critical issues returned.
- **Pass/Fail:** ☐

### TC-MC-137: Docs API returns markdown content
- **Precondition:** Module doc files exist (e.g. safeguarding/SPEC.md)
- **Steps:** Call `GET /api/docs/safeguarding/SPEC.md`
- **Expected Result:** Raw markdown content returned.
- **Pass/Fail:** ☐

### TC-MC-138: Docs API for missing doc
- **Precondition:** Doc file does not exist
- **Steps:** Call `GET /api/docs/safeguarding/QA-REPORT.md` (when file doesn't exist)
- **Expected Result:** Returns appropriate empty/error response (not 500).
- **Pass/Fail:** ☐

---

## 15. Edge Cases

### TC-MC-150: No data — all JSON files missing
- **Precondition:** Remove or rename all data source JSON files
- **Steps:** Load dashboard
- **Expected Result:** Dashboard renders without crashing. All panels show empty/placeholder states (e.g. "No modules tracked", "No builds yet", "No revenue data"). No console errors. No white screens.
- **Pass/Fail:** ☐

### TC-MC-151: All modules green (G1-G5 passed, 4/4 docs)
- **Precondition:** GATE-TRACKER.json with all modules at G5 passed, all docs present
- **Steps:** View Gate Tracker
- **Expected Result:** All gate icons are ● emerald. All docs show 4/4. All status columns show 🟢. No blocked indicators. Filter "Complete" shows all modules.
- **Pass/Fail:** ☐

### TC-MC-152: All modules red (all blocked/failed)
- **Precondition:** GATE-TRACKER.json with all modules having failed gates, missing docs, releaseBlocked: true
- **Steps:** View Gate Tracker
- **Expected Result:** Gate icons show ✕ red for failed gates. Status column all 🔴. Block reasons visible. Header status dot is red. Filter "Blocked" shows all.
- **Pass/Fail:** ☐

### TC-MC-153: Long audit trail pagination (1000+ entries)
- **Precondition:** AUDIT-LOG.jsonl with 1000+ entries
- **Steps:** Load audit trail, scroll/paginate through all entries
- **Expected Result:** Loads in batches (default 50). Pagination works smoothly. No performance degradation. No missing entries. No browser freezing.
- **Pass/Fail:** ☐

### TC-MC-154: Rapid data changes during viewing
- **Precondition:** Dashboard open, files being written to by agents
- **Steps:** While viewing dashboard, have another process append 10 entries to AUDIT-LOG.jsonl and update GATE-TRACKER.json
- **Expected Result:** Next SWR refresh picks up all changes. No partial reads, no JSON parse errors. UI updates smoothly.
- **Pass/Fail:** ☐

### TC-MC-155: Very long module/product names
- **Precondition:** Add module with 100+ character name
- **Steps:** View Gate Tracker and Product Status
- **Expected Result:** Text truncates with ellipsis or wraps gracefully. Layout does not break.
- **Pass/Fail:** ☐

### TC-MC-156: Zero revenue with high target
- **Precondition:** REVENUE.json: current £0, target £10,000
- **Steps:** View Revenue Tracker
- **Expected Result:** Progress bar at 0%. "Daily Needed" calculation is correct (target ÷ days remaining). Chart shows flat line at 0 with dashed target pace line ascending.
- **Pass/Fail:** ☐

### TC-MC-157: All builds passing (100% success)
- **Precondition:** BUILD-LOG.json with only passing builds
- **Steps:** View Build Log
- **Expected Result:** Summary shows "100% success rate". All rows show PASS in emerald. Failure pie chart is empty or hidden. No errors.
- **Pass/Fail:** ☐

### TC-MC-158: All builds failing (0% success)
- **Precondition:** BUILD-LOG.json with only failing builds
- **Steps:** View Build Log
- **Expected Result:** Summary shows "0% success rate". All rows FAIL in red. Pie chart shows failure category breakdown.
- **Pass/Fail:** ☐

---

## 16. Performance & Build

### TC-MC-160: Dashboard loads in under 2 seconds
- **Precondition:** App built and running (`npm run build && npm start`)
- **Steps:** Hard refresh the page, measure load time
- **Expected Result:** Full dashboard renders with seed data in <2 seconds (measured by Lighthouse or browser DevTools).
- **Pass/Fail:** ☐

### TC-MC-161: `npm run build` succeeds with zero errors
- **Precondition:** All code complete
- **Steps:** Run `npm run build`
- **Expected Result:** Build completes with 0 errors, 0 TypeScript errors. Warnings acceptable but no errors.
- **Pass/Fail:** ☐

### TC-MC-162: No console errors or hydration mismatches
- **Precondition:** Dashboard loaded
- **Steps:** Open browser DevTools console, navigate all pages
- **Expected Result:** Zero console errors. Zero hydration mismatch warnings.
- **Pass/Fail:** ☐

---

## Summary

| Area | Test Cases | Range |
|------|-----------|-------|
| Header Bar | 5 | TC-MC-001 – 005 |
| Gate Tracker | 8 | TC-MC-010 – 017 |
| Build Log | 6 | TC-MC-020 – 025 |
| Team Activity | 2 | TC-MC-030 – 031 |
| Revenue Tracker | 4 | TC-MC-040 – 043 |
| Product Status | 3 | TC-MC-050 – 052 |
| Task Overview | 1 | TC-MC-060 |
| Issue Tracker | 2 | TC-MC-070 – 071 |
| Audit Trail | 6 | TC-MC-080 – 085 |
| Ed Chat | 4 | TC-MC-090 – 093 |
| Dark Theme | 2 | TC-MC-100 – 101 |
| Real-Time Refresh | 3 | TC-MC-110 – 112 |
| Responsive Design | 4 | TC-MC-120 – 123 |
| API Routes | 9 | TC-MC-130 – 138 |
| Edge Cases | 9 | TC-MC-150 – 158 |
| Performance & Build | 3 | TC-MC-160 – 162 |
| **Total** | **71** | |
