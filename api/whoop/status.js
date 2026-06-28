import { admin, getUserId } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ error: "Not signed in" }); return; }
  const { data } = await admin.from("whoop_tokens").select("last_sync").eq("user_id", userId).maybeSingle();
  res.status(200).json({ connected: Boolean(data), lastSync: data?.last_sync || null });
}
