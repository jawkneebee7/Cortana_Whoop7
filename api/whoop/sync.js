import { admin, getUserId } from "../_lib/supabaseAdmin.js";
import { validToken, whoopGet } from "../_lib/whoop.js";

const dateOf = (s) => (s ? new Date(s).toISOString().slice(0, 10) : null);

/*
 * Pull the last ~25 records from recovery, sleep, and cycle, map each to a calendar
 * date, and merge the biometric fields into the user's `biometric-data` blob,
 * preserving their logs and journal entries.
 *
 * NOTE: WHOOP's exact field paths/units occasionally shift between accounts and API
 * revisions. The mappings below match the documented v2 shapes; verify them against
 * your first real payload and adjust if a metric looks off (the HRV unit in
 * particular — see the heuristic below).
 */
async function syncUser(userId) {
  const token = await validToken(userId);
  if (!token) return { error: "WHOOP not connected" };

  const [rec, slp, cyc] = await Promise.all([
    whoopGet("/v2/recovery?limit=25", token).catch(() => ({ records: [] })),
    whoopGet("/v2/activity/sleep?limit=25", token).catch(() => ({ records: [] })),
    whoopGet("/v2/cycle?limit=25", token).catch(() => ({ records: [] })),
  ]);

  const byDate = {};
  const touch = (d) => (byDate[d] ||= {});
  const cycleDate = {};

  for (const c of cyc.records || []) {
    const d = dateOf(c.end || c.start);
    if (!d) continue;
    cycleDate[c.id] = d;
    if (c.score?.strain != null) touch(d).strain = Math.round(c.score.strain * 10) / 10;
  }

  for (const r of rec.records || []) {
    const d = cycleDate[r.cycle_id] || dateOf(r.created_at || r.updated_at);
    if (!d) continue;
    const s = r.score || {};
    const m = touch(d);
    if (s.recovery_score != null) m.recovery = Math.round(s.recovery_score);
    if (s.resting_heart_rate != null) m.rhr = Math.round(s.resting_heart_rate);
    if (s.hrv_rmssd_milli != null) {
      // WHOOP sometimes returns HRV in seconds (e.g. 0.065) and sometimes in ms.
      const v = s.hrv_rmssd_milli;
      m.hrv = v < 5 ? Math.round(v * 1000) : Math.round(v);
    }
  }

  for (const sl of slp.records || []) {
    const d = dateOf(sl.end || sl.created_at);
    if (!d) continue;
    const s = sl.score || {};
    const m = touch(d);
    if (s.sleep_performance_percentage != null) m.sleepPerf = Math.round(s.sleep_performance_percentage);
    if (s.respiratory_rate != null) m.respRate = Math.round(s.respiratory_rate * 10) / 10;
    const st = s.stage_summary || {};
    const asleepMs = (st.total_light_sleep_time_milli || 0) + (st.total_slow_wave_sleep_time_milli || 0) + (st.total_rem_sleep_time_milli || 0);
    if (asleepMs > 0) m.sleepHours = Math.round((asleepMs / 3600000) * 10) / 10;
  }

  // Merge into the existing blob (never clobber logs/journal).
  const { data: row } = await admin.from("app_state").select("value").eq("user_id", userId).eq("key", "biometric-data").maybeSingle();
  const data = row?.value && typeof row.value === "object" ? row.value : { days: {} };
  data.days ||= {};
  for (const [d, metrics] of Object.entries(byDate)) {
    const day = data.days[d] || { metrics: {}, logs: [], journal: { text: "", mood: 3, energy: 3 } };
    day.metrics = { ...day.metrics, ...metrics };
    data.days[d] = day;
  }

  await admin.from("app_state").upsert({ user_id: userId, key: "biometric-data", value: data, updated_at: new Date().toISOString() });
  await admin.from("whoop_tokens").update({ last_sync: new Date().toISOString() }).eq("user_id", userId);
  return { days: Object.keys(byDate).length };
}

export default async function handler(req, res) {
  // Webhook path: WHOOP POSTs { user_id, id, type } with no auth header.
  // (For production, add WHOOP webhook signature verification here.)
  if (req.method === "POST" && req.body && req.body.user_id && !req.headers.authorization) {
    const whoopUserId = String(req.body.user_id);
    const { data } = await admin.from("whoop_tokens").select("user_id").eq("whoop_user_id", whoopUserId).maybeSingle();
    if (data?.user_id) { try { await syncUser(data.user_id); } catch { /* swallow */ } }
    res.status(200).json({ ok: true });
    return;
  }

  // Manual sync from the app.
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ error: "Not signed in" }); return; }
  try {
    const out = await syncUser(userId);
    res.status(out.error ? 400 : 200).json(out);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
