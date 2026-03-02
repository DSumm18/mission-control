#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const WATCHLIST = path.join(ROOT, 'data', 'youtube-watchlist.json');
const STATE = path.join(ROOT, 'data', 'youtube-watch-state.json');
const TRANSCRIPTS = path.join(ROOT, 'data', 'transcripts');
const LOG = path.join(ROOT, 'logs', 'youtube-watch.log');

function log(msg) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`);
}

function loadEnv(file = path.join(ROOT, '.env.local')) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

async function fetchRss(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url, { headers: { 'user-agent': 'mission-control-youtube-watch/1.0' } });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  return await res.text();
}

function parseEntries(xml) {
  const entries = [];
  const blocks = xml.split('<entry>').slice(1).map(s => s.split('</entry>')[0]);
  for (const b of blocks) {
    const id = (b.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (b.match(/<title>([^<]+)<\/title>/) || [])[1];
    const link = (b.match(/<link[^>]+href="([^"]+)"/) || [])[1];
    const published = (b.match(/<published>([^<]+)<\/published>/) || [])[1];
    if (id && title && link) entries.push({ id, title, link, published });
  }
  return entries;
}

function tryTranscript(videoUrl, videoId) {
  fs.mkdirSync(TRANSCRIPTS, { recursive: true });
  try {
    execSync(`PATH=\"$HOME/Library/Python/3.9/bin:$PATH\" yt-dlp --skip-download --write-auto-subs --sub-langs \"en.*\" --convert-subs srt -o \"${path.join(TRANSCRIPTS, `${videoId}.%(ext)s`)}\" \"${videoUrl}\"`, { stdio: 'pipe', shell: '/bin/bash' });
  } catch {}
  const files = fs.readdirSync(TRANSCRIPTS).filter(f => f.startsWith(videoId) && f.endsWith('.srt'));
  if (!files.length) return { ok: false, path: null, sha256: null };
  const fp = path.join(TRANSCRIPTS, files[0]);
  const buf = fs.readFileSync(fp);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  return { ok: true, path: fp, sha256: sha };
}

function getVideoMeta(videoUrl) {
  try {
    const raw = execSync(`PATH=\"$HOME/Library/Python/3.9/bin:$PATH\" yt-dlp --dump-single-json --skip-download \"${videoUrl}\"`, { stdio: 'pipe', shell: '/bin/bash' }).toString();
    const j = JSON.parse(raw);
    return {
      uploader: j.uploader || j.channel || null,
      upload_date: j.upload_date || null,
      duration: j.duration || null,
      channel_id: j.channel_id || null
    };
  } catch {
    return { uploader: null, upload_date: null, duration: null, channel_id: null };
  }
}

async function upsertSourceAndUpdate(sb, ch, entry) {
  const { data: src, error: se } = await sb.from('mc_signal_sources').upsert({
    name: ch.name,
    source_type: 'news',
    domain: 'youtube.com',
    check_cadence: 'daily',
    reliability_score: 6,
    active: true,
    notes: ch.summaryHint
  }, { onConflict: 'name' }).select('id').single();
  if (se) throw se;

  const meta = getVideoMeta(entry.link);
  const tx = tryTranscript(entry.link, entry.id);
  const summary = `${ch.summaryHint}. Metadata: uploader=${meta.uploader || 'n/a'}, upload_date=${meta.upload_date || 'n/a'}, duration_sec=${meta.duration || 'n/a'}. Transcript=${tx.ok ? 'available' : 'unavailable'}.`;

  const { error: ue } = await sb.from('mc_source_updates').upsert({
    source_id: src.id,
    topic_area: ch.topicArea,
    headline: entry.title,
    summary,
    url: entry.link,
    published_at: entry.published || null,
    dataset_name: 'YouTube signal',
    verified_official: false,
    potential_newsletter_angle: ch.angleHint,
    impact_score: 6
  }, { onConflict: 'url' });
  if (ue) throw ue;

  return { transcript: tx };
}

async function main() {
  const env = { ...process.env, ...loadEnv() };
  const sbUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) throw new Error('Supabase env missing');

  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
  const wl = readJson(WATCHLIST, { channels: [] });
  const state = readJson(STATE, { seen: {} });

  let newCount = 0;
  for (const ch of wl.channels) {
    const xml = await fetchRss(ch.channelId);
    const entries = parseEntries(xml).slice(0, 8);
    const seenSet = new Set(state.seen[ch.channelId] || []);

    for (const e of entries) {
      if (seenSet.has(e.id)) continue;
      try {
        const out = await upsertSourceAndUpdate(sb, ch, e);
        log(`added video=${e.id} channel=${ch.name} transcript=${out.transcript.ok}`);
        newCount++;
      } catch (err) {
        log(`error video=${e.id} channel=${ch.name} msg=${err.message || err}`);
      }
      seenSet.add(e.id);
    }

    state.seen[ch.channelId] = Array.from(seenSet).slice(-80);
  }

  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ ok: true, newCount }));
}

main().catch((e) => {
  log(`fatal ${e.message || e}`);
  console.error(e.message || e);
  process.exit(1);
});
