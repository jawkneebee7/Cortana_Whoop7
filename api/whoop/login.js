import crypto from "node:crypto";
import { admin, getUserId } from "../_lib/supabaseAdmin.js";
import { WHOOP_AUTH, SCOPES } from "../_lib/whoop.js";

/* Builds the WHOOP authorization URL for the signed-in user. */
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ error: "Not signed in" }); return; }

  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_REDIRECT_URI) {
    res.status(500).json({ error: "WHOOP_CLIENT_ID / WHOOP_REDIRECT_URI not configured." });
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  await admin.from("whoop_oauth_state").insert({ state, user_id: userId });

  const url = new URL(WHOOP_AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.WHOOP_CLIENT_ID);
  url.searchParams.set("redirect_uri", process.env.WHOOP_REDIRECT_URI);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);

  res.status(200).json({ url: url.toString() });
}
