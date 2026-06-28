import { admin } from "./supabaseAdmin.js";

export const WHOOP_API = "https://api.prod.whoop.com";
export const WHOOP_AUTH = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token";

// `offline` is required to receive a refresh token.
export const SCOPES = [
  "offline",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:profile",
  "read:body_measurement",
];

export async function getTokens(userId) {
  const { data } = await admin.from("whoop_tokens").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

export async function saveTokens(userId, t, whoopUserId) {
  const expires_at = new Date(Date.now() + ((t.expires_in || 3600) - 60) * 1000).toISOString();
  const row = {
    user_id: userId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at,
    updated_at: new Date().toISOString(),
  };
  if (whoopUserId !== undefined && whoopUserId !== null) row.whoop_user_id = String(whoopUserId);
  await admin.from("whoop_tokens").upsert(row);
}

/*
 * WHOOP rotates refresh tokens: each refresh returns a NEW refresh token and
 * invalidates the old one. We persist the new pair immediately. (Single-user
 * morning sync means concurrent refreshes are unlikely; a multi-user version
 * would want a per-user lock here.)
 */
async function refresh(userId, tokens) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
    scope: "offline",
  });
  const r = await fetch(WHOOP_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("WHOOP token refresh failed: " + r.status);
  const t = await r.json();
  await saveTokens(userId, t);
  return t.access_token;
}

export async function validToken(userId) {
  const tk = await getTokens(userId);
  if (!tk) return null;
  if (new Date(tk.expires_at).getTime() > Date.now()) return tk.access_token;
  return await refresh(userId, tk);
}

export async function whoopGet(path, token) {
  const r = await fetch(WHOOP_API + path, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`WHOOP GET ${path} -> ${r.status}`);
  return r.json();
}
