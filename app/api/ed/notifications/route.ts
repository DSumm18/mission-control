/**
 * Ed Notifications API.
 *
 * GET  /api/ed/notifications — list pending/delivered notifications
 * PATCH /api/ed/notifications — acknowledge or dismiss a notification
 */

import { NextRequest } from 'next/server';
import {
  getPendingNotifications,
  getNotificationCount,
  markAcknowledged,
  dismissNotification,
} from '@/lib/ed/notifications';

export async function GET(req: NextRequest) {
  const countOnly = req.nextUrl.searchParams.get('count') === 'true';

  if (countOnly) {
    const count = await getNotificationCount();
    return Response.json({ count });
  }

  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
  const notifications = await getPendingNotifications(limit);
  return Response.json(notifications);
}

export async function PATCH(req: NextRequest) {
  let body: { id: string; action: 'acknowledge' | 'dismiss' };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.id || !body.action) {
    return Response.json({ error: 'id and action are required' }, { status: 400 });
  }

  switch (body.action) {
    case 'acknowledge':
      await markAcknowledged(body.id);
      return Response.json({ ok: true });
    case 'dismiss':
      await dismissNotification(body.id);
      return Response.json({ ok: true });
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
}
