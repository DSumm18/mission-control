import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

/**
 * Telegram webhook — receives messages from @SummersEdBot.
 * Sends a typing indicator immediately, then queues the message
 * for the local Ed bridge (scripts/ed-telegram.mjs) to process
 * via Claude CLI on the Mac Mini.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text?.trim() || '';
    const from = message.from?.first_name || 'david';
    const messageId = message.message_id;

    // Send typing indicator immediately so David knows we received it
    await sendChatAction(chatId, 'typing');

    // Build metadata from attachments
    const metadata: Record<string, unknown> = {};
    if (message.photo?.length > 0) {
      metadata.photo = message.photo[message.photo.length - 1];
    }
    if (message.document) {
      metadata.document = message.document;
    }
    const urls = text.match(/https?:\/\/[^\s]+/g);
    if (urls) {
      metadata.urls = urls;
    }

    // Queue message for Ed bridge
    const sb = supabaseAdmin();
    await sb.from('mc_telegram_messages').insert({
      chat_id: chatId,
      message_id: messageId,
      from_name: from.toLowerCase(),
      role: 'user',
      content: text || message.caption || '',
      photo_file_id: message.photo?.[message.photo.length - 1]?.file_id || null,
      status: 'pending',
      metadata,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Telegram webhook error:', e);
    return NextResponse.json({ ok: true }); // Always 200 to Telegram
  }
}

async function sendChatAction(chatId: number, action: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {}); // non-critical
}
