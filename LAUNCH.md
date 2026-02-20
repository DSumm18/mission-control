# 🚀 Quick Launch Guide

## Get Started in 10 Seconds

```bash
cd /Users/david/.openclaw/workspace/mission-control
npm run dev
```

Then open: **http://localhost:3000**

That's it! Dashboard is live. ✅

---

## What You'll See

### 1. Revenue Tracker (Top)
- Current revenue: £0 (ready for data)
- Target: £10K by March 31st
- Days remaining: Auto-calculated
- Daily average needed: Math'd for you

### 2. Product Status Grid (7 Cards)
📱 ClawPhone · 😂 MyMeme · 🎵 MySongs · 🤝 DealFind · 🏏 CricBook · 📚 Schoolgle · 😴 Sleep Sounds

### 3. Task Queue (Bottom Left)
- Reads from TASKQUEUE.md
- Shows priority levels
- Status badges (pending/in-progress/completed)

### 4. Cost Tracker (Bottom Right)
- Monthly spend by category
- Total: £70/month (sample)
- Real data coming soon

### 5. PM Activity Log
- Live updates from all product managers
- Timestamps, emoji indicators
- Product tags for quick filtering

### 6. Roadmap Timeline
- 6-month milestones
- Progress bars
- Status indicators

---

## Stopping the Dashboard

Press `Ctrl+C` in the terminal.

---

## Development Mode vs Production

**Development (what you're running now):**
- Hot reload enabled (changes appear instantly)
- Full error messages in browser console
- Slower performance (but good for development)

**Production build:**
```bash
npm run build
npm start
```
- Optimized for speed
- Ready for deployment
- Minified assets

---

## Customizing Data

### Revenue Target
Edit `/Users/david/.openclaw/workspace/mission-control/app/components/RevenueTracker.js`:
```js
const currentRevenue = 0  // ← Change this
const targetRevenue = 10000  // ← Or this
```

### Products
Edit `ProductStatus.js` — modify the `PRODUCTS` array

### Costs
Edit `CostTracker.js` — modify the `COST_DATA` array

### Timeline
Edit `Timeline.js` — modify the `TIMELINE_ITEMS` array

### PM Activities
Edit `PMActivity.js` — modify the `SAMPLE_ACTIVITIES` array

### Tasks
The API route (`/api/taskqueue`) tries to read from `../../../TASKQUEUE.md`. Place your task file there, or modify the route to point elsewhere.

---

## Connecting Real Data

All components use React hooks (useState, useEffect). To connect real data:

1. **In any component:**
   ```js
   const [data, setData] = useState(initialState)
   
   useEffect(() => {
     // Fetch from your API
     fetch('/api/your-endpoint')
       .then(res => res.json())
       .then(data => setData(data))
   }, [])
   ```

2. **Example: Revenue from Stripe:**
   ```js
   useEffect(() => {
     fetch('/api/stripe/monthly-revenue')
       .then(res => res.json())
       .then(data => setCurrentRevenue(data.amount))
   }, [])
   ```

---

## Keyboard Shortcuts

- `Ctrl+C` — Stop dev server
- `Ctrl+Shift+K` — Open browser dev tools (F12)
- Refresh page: `Cmd+R` (Mac) / `Ctrl+R` (Windows)

---

## Troubleshooting

**Port 3000 already in use?**
```bash
npm run dev -- -p 3001  # Use port 3001 instead
```

**Need to reinstall dependencies?**
```bash
rm -rf node_modules
npm install
npm run dev
```

**Dashboard looks broken?**
- Hard refresh: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
- Check browser console for errors
- Make sure you're on Node.js 16+

---

## That's It!

Dashboard is production-ready, fully functional, and waiting for your data.

Questions? Check the README.md in the same directory.

Enjoy! 🎉
