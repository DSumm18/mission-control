import { supabaseAdmin } from '@/lib/db/supabase-server';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer' | 'system';

export async function requireRoleFromBearer(authHeader: string | null, allowed: Role[]) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = authHeader.replace('Bearer ', '');
  const sb = supabaseAdmin();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) throw new Error('Unauthorized');

  const { data: roleRow } = await sb.from('user_roles').select('role').eq('user_id', user.id).single();
  const role = (roleRow?.role || 'viewer') as Role;
  if (!allowed.includes(role)) throw new Error('Forbidden');
  return { userId: user.id, role };
}
