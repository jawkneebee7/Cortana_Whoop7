import { createClient } from "@supabase/supabase-js";

/*
 * Server-side Supabase client with the SERVICE ROLE key. This bypasses Row-Level
 * Security, so it is only ever used inside serverless functions — never shipped to
 * the browser. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.
 */
export const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* Verify the caller's Supabase session from the Authorization: Bearer header. */
export async function getUserId(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}
