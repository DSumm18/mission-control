/**
 * Ed Notification service.
 * CRUD operations for mc_ed_notifications table.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';

export type NotificationCategory =
  | 'job_complete'
  | 'job_failed'
  | 'decision_needed'
  | 'approval_needed'
  | 'deploy_ready'
  | 'alert'
  | 'info'
  | 'reminder';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateNotificationParams {
  title: string;
  body?: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  source_type?: string;
  source_id?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface EdNotification {
  id: string;
  title: string;
  body: string | null;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: string;
  source_type: string | null;
  source_id: string | null;
  delivered_via: string[] | null;
  delivered_at: string | null;
  acknowledged_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Create a new notification.
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<EdNotification | null> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('mc_ed_notifications')
    .insert({
      title: params.title,
      body: params.body || null,
      category: params.category,
      priority: params.priority || 'normal',
      source_type: params.source_type || null,
      source_id: params.source_id || null,
      expires_at: params.expires_at || null,
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }

  return data;
}

/**
 * Get pending/delivered notifications (newest first).
 */
export async function getPendingNotifications(
  limit = 20,
): Promise<EdNotification[]> {
  const sb = supabaseAdmin();

  const { data } = await sb
    .from('mc_ed_notifications')
    .select('*')
    .in('status', ['pending', 'delivered'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get notification count for badge display.
 */
export async function getNotificationCount(): Promise<number> {
  const sb = supabaseAdmin();

  const { count } = await sb
    .from('mc_ed_notifications')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'delivered']);

  return count || 0;
}

/**
 * Mark notification as delivered via a specific channel.
 */
export async function markDelivered(
  id: string,
  channel: string,
): Promise<void> {
  const sb = supabaseAdmin();

  // Get current delivered_via to append
  const { data: current } = await sb
    .from('mc_ed_notifications')
    .select('delivered_via')
    .eq('id', id)
    .single();

  const channels = new Set(current?.delivered_via || []);
  channels.add(channel);

  await sb
    .from('mc_ed_notifications')
    .update({
      status: 'delivered',
      delivered_via: [...channels],
      delivered_at: new Date().toISOString(),
    })
    .eq('id', id);
}

/**
 * Mark notification as acknowledged by David.
 */
export async function markAcknowledged(id: string): Promise<void> {
  const sb = supabaseAdmin();

  await sb
    .from('mc_ed_notifications')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', id);
}

/**
 * Dismiss a notification.
 */
export async function dismissNotification(id: string): Promise<void> {
  const sb = supabaseAdmin();

  await sb
    .from('mc_ed_notifications')
    .update({ status: 'dismissed' })
    .eq('id', id);
}
