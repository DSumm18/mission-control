import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const dataPath = path.resolve(process.cwd(), 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  for (const p of data.products || []) {
    await sb.from('projects').upsert({
      slug: p.id,
      name: p.name,
      status: p.status,
      percent_complete: p.percentComplete || 0,
      blocker: p.blocker || null,
      confidence: p.confidence || null,
      source_payload: p
    }, { onConflict: 'slug' });
  }

  for (const i of data.integrations || []) {
    await sb.from('integrations').upsert({
      name: i.name || i.id,
      status: i.status || 'unknown',
      config: i
    }, { onConflict: 'name' });
  }

  for (const j of data.jobs || []) {
    await sb.from('tasks').insert({
      title: j.title || j.name || 'Imported Job',
      description: JSON.stringify(j),
      status: 'queued'
    });
  }

  for (const [k, v] of Object.entries(data.revenue || {})) {
    const value = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
    await sb.from('kpis').upsert({ key: k, value_numeric: Number.isFinite(value) ? value : null, value_text: String(v) }, { onConflict: 'key' });
  }

  console.log('Seed import complete');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
