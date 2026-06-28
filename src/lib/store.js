/*
 * Storage layer with two backends behind one async interface (get/set/delete/list).
 *
 *  • Supabase mode (when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set):
 *    data lives in the `app_state` table, scoped to the signed-in user, so web and
 *    phone share one dataset. Row-Level Security keeps each user to their own rows.
 *
 *  • Local mode (no Supabase env): browser localStorage, device-only, zero config.
 *
 * App.jsx never knows which is active — it only ever calls store.get/set/...
 */
import { supabase, hasSupabase } from "./supabase";

const PREFIX = "vs:";

const local = {
  async get(key) { const v = localStorage.getItem(PREFIX + key); return v == null ? null : { key, value: v }; },
  async set(key, value) { localStorage.setItem(PREFIX + key, value); return { key, value }; },
  async delete(key) { localStorage.removeItem(PREFIX + key); return { key, deleted: true }; },
  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + prefix)) keys.push(k.slice(PREFIX.length));
    }
    return { keys, prefix };
  },
};

async function userId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}
function asString(value) { return typeof value === "string" ? value : JSON.stringify(value); }

const remote = {
  async get(key) {
    const uid = await userId();
    if (!uid) return null;
    const { data, error } = await supabase.from("app_state").select("value").eq("user_id", uid).eq("key", key).maybeSingle();
    if (error || !data) return null;
    return { key, value: asString(data.value) };
  },
  async set(key, value) {
    const uid = await userId();
    if (!uid) return null;
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    const { error } = await supabase.from("app_state").upsert({ user_id: uid, key, value: parsed, updated_at: new Date().toISOString() });
    if (error) console.error("store.set", error);
    return { key, value };
  },
  async delete(key) {
    const uid = await userId();
    if (!uid) return null;
    await supabase.from("app_state").delete().eq("user_id", uid).eq("key", key);
    return { key, deleted: true };
  },
  async list(prefix = "") {
    const uid = await userId();
    if (!uid) return { keys: [], prefix };
    const { data } = await supabase.from("app_state").select("key").eq("user_id", uid).like("key", prefix + "%");
    return { keys: (data || []).map((r) => r.key), prefix };
  },
};

export const store = hasSupabase ? remote : local;
