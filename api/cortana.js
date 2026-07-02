export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: "ANTHROPIC_API_KEY not set" }); return; }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { system, messages = [], max_tokens = 1000 } = body;
    const model = process.env.CORTANA_MODEL || "claude-sonnet-4-6";

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    if (!r.ok) {
      console.error("Anthropic error:", r.status, text);
      res.status(r.status).json({ error: data?.error?.message || text });
      return;
    }
    res.status(200).json(data);
  } catch (e) {
    console.error("Cortana handler error:", e);
    res.status(500).json({ error: e.message || String(e) });
  }
}
