/**
 * Ed Heartbeat — morning/evening briefings via Claude CLI.
 * Called by launchd at 08:00 and 18:00 daily.
 *
 * POST /api/ed/heartbeat
 * Headers: x-runner-token: MC_RUNNER_TOKEN
 * Body: { type: 'morning' | 'evening' }
 * Response: { ok: boolean, briefing: string }
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { buildContextBlock } from '@/lib/ed/context';
import { claudeCall } from '@/lib/ed/claude-stream';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'Markdown',
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Auth check
  const token = req.headers.get('x-runner-token');
  if (token !== process.env.MC_RUNNER_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { type?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const briefingType = body.type === 'evening' ? 'evening' : 'morning';
  const sb = supabaseAdmin();

  // Build context
  const contextBlock = await buildContextBlock();

  // Run health check for evening briefings
  let healthReport = '';
  if (briefingType === 'evening') {
    try {
      const baseUrl = process.env.MC_SERVER_URL || 'http://localhost:3000';
      const hRes = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(15_000) });
      const health = await hRes.json();
      const checks = (health.checks || []) as { name: string; ok: boolean; detail: string }[];
      const failures = checks.filter(c => !c.ok);
      healthReport = `\n\n## System Health Check (${health.passed}/${health.total} passed)\n`;
      healthReport += checks.map(c => `- ${c.ok ? 'OK' : 'FAIL'} ${c.name}: ${c.detail}`).join('\n');
      if (failures.length > 0) {
        healthReport += `\n\nWARNING: ${failures.length} check(s) failed. Report these issues to David and suggest fixes.`;
      }
    } catch {
      healthReport = '\n\n## System Health Check\nUnable to run health check.';
    }
  }

  // Compose briefing prompt
  const prompt =
    briefingType === 'morning'
      ? `You are Ed, David's AI CEO. Give a concise morning briefing for today.

Context:
${contextBlock}

Format: Start with a greeting. Then cover:
1. Any overnight job results or failures
2. Top 2-3 items needing David's attention today
3. Any deadlines approaching this week
4. One proactive suggestion

Keep it under 200 words. Direct, no waffle. Use plain text (no markdown bold/italic — this goes to Telegram).`
      : `You are Ed, David's AI CEO. Give a concise evening wrap-up.

Context:
${contextBlock}
${healthReport}

Format: Start casually. Then cover:
1. What got done today
2. System health status — highlight any failures and what you'll do about them
3. Any issues that need attention tomorrow
4. Quick wins available for tomorrow morning

If any health checks failed, explain what's wrong and what self-corrective action you'd take (e.g. restarting services, requeuing failed jobs, unpausing agents).

Keep it under 200 words. Direct, no waffle. Use plain text (no markdown bold/italic — this goes to Telegram).`;

  try {
    const briefing = await claudeCall(
      'You are Ed, the CEO of Mission Control. Keep responses concise and actionable.',
      prompt,
      'haiku',
    );

    // Send to Telegram
    const telegramSent = await sendTelegram(briefing);

    // Create notification
    await sb.from('mc_ed_notifications').insert({
      title: `${briefingType === 'morning' ? 'Morning' : 'Evening'} briefing`,
      body: briefing.slice(0, 500),
      category: 'reminder',
      priority: 'normal',
      status: telegramSent ? 'delivered' : 'pending',
      metadata: { briefing_type: briefingType, telegram_sent: telegramSent },
    });

    return Response.json({ ok: true, briefing, telegram_sent: telegramSent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
