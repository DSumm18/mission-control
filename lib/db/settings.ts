import { supabaseAdmin } from "@/lib/db/supabase-server";

export async function getSetting(key: string): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("mc_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}

export async function getSettingJson<T>(key: string): Promise<T | null> {
  const val = await getSetting(key);
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}
