import { admin } from "../_lib/supabaseAdmin.js";
import { WHOOP_TOKEN, WHOOP_API, saveTokens } from "../_lib/whoop.js";

/* WHOOP redirects here after the user authorizes. Exchanges the code for tokens. */
export default async function handler(req, res) {
  const appUrl = process.env.APP_URL || "";
  const back = (status) => res.redirect(`${appUrl}/?whoop=${status}`);

  const { code, state } = req.query;
  if (!code || !state) return back("error");

  const { data: st } = await admin.from("whoop_oauth_state").select("user_id").eq("state", state).maybeSingle();
  if (!st) return back("error");

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
      redirect_uri: process.env.WHOOP_REDIRECT_URI,
    });
    const tr = await fetch(WHOOP_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    if (!tr.ok) return back("error");
    const t = await tr.json();

    // Capture the WHOOP user id so webhooks can be mapped back to this account.
    let whoopUserId;
    try {
      const p = await fetch(`${WHOOP_API}/developer/v2/user/profile/basic`, { headers: { authorization: `Bearer ${t.access_token}` } });
      if (p.ok) { const pj = await p.json(); whoopUserId = pj.user_id; }
    } catch { /* non-fatal */ }

    await saveTokens(st.user_id, t, whoopUserId);
    await admin.from("whoop_oauth_state").delete().eq("state", state);
    return back("connected");
  } catch {
    return back("error");
  }
}
