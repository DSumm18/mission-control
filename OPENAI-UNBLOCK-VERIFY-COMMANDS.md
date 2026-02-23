# Mission Control OpenAI Unblock — Verify Commands

Run after updating `OPENAI_API_KEY` in `mission-control/.env.local`.

```bash
cd /Users/david/.openclaw/workspace/mission-control
pkill -f 'next dev' || true
npm run dev
```

In a second terminal:

```bash
set -a; source /Users/david/.openclaw/workspace/mission-control/.env.local; set +a
cd /Users/david/.openclaw/workspace/mission-control
node -e "const OpenAI=require('openai').default;(async()=>{try{const c=new OpenAI({apiKey:process.env.OPENAI_API_KEY});await c.responses.create({model:process.env.MC_LLM_ROUTER_MODEL||'gpt-4.1-mini',input:'ping'});console.log('HTTP_STATUS=200');console.log('SUCCESS=YES')}catch(e){console.log('HTTP_STATUS='+(e?.status??e?.response?.status??'unknown'));console.log('SUCCESS=NO')}})();"
```

Expected success output:
- `HTTP_STATUS=200`
- `SUCCESS=YES`
