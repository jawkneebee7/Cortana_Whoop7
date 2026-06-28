import { createClient } from "@supabase/supabase-js";

/*
 * If these two env vars are set (in .env locally and in Vercel), the app runs in
 * "synced" mode: login + Postgres, shared across every device. If they're absent,
 * the app falls back to browser-only storage so it still runs with zero config.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && anon);
export const supabase = hasSupabase ? createClient(url, anon) : null;
