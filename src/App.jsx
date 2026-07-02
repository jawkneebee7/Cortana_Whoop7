import React, { useState, useEffect, useMemo, useCallback, useId } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import {
  Activity, Heart, Moon, Flame, Wind, Plus, FlaskConical, Sparkles,
  Trash2, X, Coffee, Wine, Dumbbell, Brain, Sun, Check,
  TrendingUp, BookOpen, Loader, PenLine,
} from "lucide-react";
import { store } from "./lib/store";
import { supabase, hasSupabase } from "./lib/supabase";

/* ------------------------------------------------------------------ */
/*  Palette + type — drawn from Cabanel's Fallen Angel: obsidian,      */
/*  parchment, one smoldering ember accent, cold steel for the data.   */
/* ------------------------------------------------------------------ */
const C = {
  obsidian: "#0D0D10", panel: "#15151A", panel2: "#1C1C23", border: "#2A2A33",
  bone: "#E9E4D9", ash: "#8C8A84", dim: "#5E5C58",
  ember: "#C2453B", emberDeep: "#8E2F28",
  brass: "#C49A4A", sage: "#8FA67E", steel: "#7E9BB3", plum: "#8A7BA6",
};

const recColor = (r) => (r == null ? C.dim : r < 34 ? C.ember : r < 67 ? C.brass : C.sage);

const VOICES = {
  stoic: { name: "Stoic", blurb: "She speaks as a Stoic would: measured, unsentimental, oriented toward what is within his control." },
  operator: { name: "Operator", blurb: "She speaks coldly and tactically, reading his state like a system readout and issuing a clear order of operations." },
  coach: { name: "Coach", blurb: "She speaks as a direct strength coach: blunt, encouraging when earned, specific about training and recovery." },
};

const CATEGORIES = {
  training: { label: "Training", icon: Dumbbell, color: C.brass },
  practice: { label: "Practice", icon: Brain, color: C.steel },
  food: { label: "Food", icon: Sun, color: C.sage },
  consumption: { label: "Consumption", icon: Wine, color: C.ember },
  caffeine: { label: "Caffeine", icon: Coffee, color: C.plum },
  context: { label: "Context", icon: BookOpen, color: C.ash },
};

const METRICS = {
  recovery: { label: "Recovery", unit: "%", icon: Heart, color: C.sage, hi: "up" },
  hrv: { label: "HRV", unit: "ms", icon: Activity, color: C.steel, hi: "up" },
  rhr: { label: "Resting HR", unit: "bpm", icon: Heart, color: C.ember, hi: "down" },
  sleepPerf: { label: "Sleep", unit: "%", icon: Moon, color: C.plum, hi: "up" },
  sleepHours: { label: "Sleep dur.", unit: "h", icon: Moon, color: C.plum, hi: "up" },
  strain: { label: "Strain", unit: "", icon: Flame, color: C.brass, hi: "neutral" },
  respRate: { label: "Resp. rate", unit: "rpm", icon: Wind, color: C.ash, hi: "neutral" },
};

/* dates ------------------------------------------------------------- */
const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const addDays = (dstr, n) => { const d = new Date(dstr + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const pretty = (dstr) => new Date(dstr + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const shortD = (dstr) => new Date(dstr + "T00:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric" });

/* ------------------------------------------------------------------ */
/*  Seed — 42 days with real patterns baked in, plus mood/energy and   */
/*  some reflective entries so the journal correlation has signal.     */
/* ------------------------------------------------------------------ */
const GOOD_LINES = [
  "Woke up clear. The early walk did something — felt unhurried for once.",
  "Good session. There's a calm after lifting that nothing else gives me.",
  "Slow morning, but the meditation held. Stayed patient through a hard call.",
  "Steady day. Nothing dramatic, just the quiet sense of being on track.",
  "Long day but a clean one. Slept the moment my head hit the pillow.",
  "Felt sharp in the partner meeting. Rest is paying off in places I didn't expect.",
];
const HARD_LINES = [
  "Dragged all day. Too much screen, not enough air.",
  "Restless night. Mind wouldn't settle, kept circling work.",
  "Felt the wine this morning. Not worth it lately.",
  "Energy crashed after lunch. Need to watch the afternoon coffee.",
  "Off-center today. Couldn't tell if it was the body or the mind leading.",
  "Short fuse. Slept badly and it showed in everything.",
];

function seedData() {
  const days = {};
  const n = 42;
  let hrvBase = 74;
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today(), -i);
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay();
    const logs = [];
    const r = (a, b) => a + Math.random() * (b - a);
    const uid = () => Math.random().toString(36).slice(2, 10);

    const drank = (dow === 5 || dow === 6) && Math.random() < 0.6;
    const practiced = Math.random() < 0.42;
    const trained = dow !== 0 && Math.random() < 0.6;
    const lateCaffeine = Math.random() < 0.25;

    let strain = trained ? r(11, 17.5) : r(5, 10);
    if (dow === 0) strain = r(3, 7);

    let recovery = r(48, 84);
    if (drank) recovery -= r(18, 30);
    if (practiced) recovery += r(4, 9);
    if (strain > 15) recovery -= r(6, 12);
    if (lateCaffeine) recovery -= r(3, 7);
    recovery = Math.max(8, Math.min(99, Math.round(recovery)));

    hrvBase += r(-4, 4);
    let hrv = hrvBase + (practiced ? r(3, 10) : 0) - (drank ? r(8, 18) : 0) - (lateCaffeine ? r(2, 6) : 0);
    hrv = Math.max(28, Math.round(hrv));

    let rhr = 53 + (drank ? r(3, 7) : 0) + (strain > 15 ? r(1, 4) : 0) - (practiced ? r(0, 2) : 0) + r(-2, 2);
    rhr = Math.round(rhr);

    let sleepHours = r(6.2, 8.3) - (drank ? r(0.4, 1.1) : 0);
    sleepHours = Math.round(sleepHours * 10) / 10;
    let sleepPerf = Math.round(Math.min(99, (sleepHours / 8.2) * 100 + r(-6, 6)));

    if (trained) logs.push({ id: uid(), time: "17:30", category: "training", label: ["Strength", "Conditioning", "Zone 2 run", "Mobility"][Math.floor(Math.random() * 4)], detail: "" });
    if (practiced) logs.push({ id: uid(), time: "21:00", category: "practice", label: ["Evening yoga", "Meditation", "Breathwork", "Reiki"][Math.floor(Math.random() * 4)], detail: "" });
    if (drank) logs.push({ id: uid(), time: "20:30", category: "consumption", label: "Alcohol", detail: `${Math.random() < 0.5 ? 2 : 3} drinks` });
    if (lateCaffeine) logs.push({ id: uid(), time: "15:30", category: "caffeine", label: "Late caffeine", detail: "" });

    const mood = Math.max(1, Math.min(5, Math.round(2 + recovery / 32 + r(-0.6, 0.6))));
    const energy = Math.max(1, Math.min(5, Math.round(1.5 + recovery / 30 + (practiced ? 0.4 : 0) + r(-0.6, 0.6))));
    let journal = { mood, energy, text: "" };
    if (Math.random() < 0.5) {
      const pool = mood >= 3 ? GOOD_LINES : HARD_LINES;
      journal.text = pool[Math.floor(Math.random() * pool.length)];
    }

    days[date] = {
      metrics: {
        recovery, hrv, rhr, sleepPerf, sleepHours,
        strain: Math.round(strain * 10) / 10,
        respRate: Math.round((14 + r(-1.2, 1.2)) * 10) / 10,
      },
      logs,
      journal,
    };
  }
  return { days };
}

/* storage ----------------------------------------------------------- */
const KEY = "biometric-data";
const EXP = "biometric-experiments";
const SET = "biometric-settings";
const uid = () => Math.random().toString(36).slice(2, 10);

async function loadKey(key, fallback) {
  try { const r = await store.get(key); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
async function saveKey(key, val) {
  try { await store.set(key, JSON.stringify(val)); } catch (e) { console.error("save failed", e); }
}

/* stats ------------------------------------------------------------- */
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
};
function cohenD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const pooled = Math.sqrt(((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) / (a.length + b.length - 2));
  if (!pooled) return null;
  return (mean(a) - mean(b)) / pooled;
}
const dLabel = (d) => {
  const a = Math.abs(d);
  if (a < 0.2) return "negligible";
  if (a < 0.5) return "small";
  if (a < 0.8) return "moderate";
  return "large";
};

/* Cortana's instant read — heuristic, no network, always present ---- */
function cortanaSuggestion(days) {
  const dts = Object.keys(days).sort();
  if (dts.length < 2) return "Log a few days and I'll start seeing your patterns.";
  const last = dts[dts.length - 1], prev = dts[dts.length - 2];
  const m = days[last].metrics || {};
  const drankYesterday = (days[prev]?.logs || []).some((l) => l.category === "consumption");
  const avgSleep = mean(dts.slice(-3).map((d) => days[d].metrics.sleepHours).filter(Boolean));
  const last3hrv = mean(dts.slice(-3).map((d) => days[d].metrics.hrv).filter(Boolean));
  const prior3hrv = mean(dts.slice(-6, -3).map((d) => days[d].metrics.hrv).filter(Boolean));

  if (m.recovery != null && m.recovery < 45 && drankYesterday)
    return "Last night's drinks are still on the ledger — your recovery's down. Tonight: water, an early close, no screens past ten. You'll buy tomorrow back.";
  if (m.recovery != null && m.recovery >= 67)
    return "You're primed today. This is the day to add the load you'll be proud of — push the session, not the caffeine.";
  if (avgSleep != null && avgSleep < 6.8)
    return "Three short nights are stacking up. Make tonight a hard ten o'clock — most of what you want depends on it.";
  if (last3hrv != null && prior3hrv != null && last3hrv < prior3hrv - 3)
    return "Your HRV's been drifting down all week. Pull the intensity back a notch today and let the system catch up.";
  if (m.recovery != null && m.recovery < 34)
    return "You're deep in the red. Restraint is the disciplined move — move lightly, eat well, protect your sleep tonight.";
  return "Steady ground today. Train with precision over volume, and guard tonight's sleep like it matters — because it does.";
}

/* AI — routed through our own serverless proxy so the API key stays server-side */
async function callClaude(system, user) {
  const res = await fetch("/api/cortana", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}
function compactContext(days, dates) {
  return dates.map((dt) => {
    const day = days[dt]; if (!day) return null;
    const m = day.metrics;
    const tags = (day.logs || []).map((l) => l.label).join(", ");
    const jr = day.journal?.mood ? ` | mood ${day.journal.mood}/5` : "";
    return `${dt}: rec ${m.recovery}%, hrv ${m.hrv}ms, rhr ${m.rhr}, sleep ${m.sleepPerf}% (${m.sleepHours}h), strain ${m.strain}${tags ? ` | ${tags}` : ""}${jr}`;
  }).filter(Boolean).join("\n");
}

/* ================================================================== */
/*  Cortana — an original animated presence (not any existing IP),    */
/*  an ember-cored sigil that takes on the color of today's recovery. */
/* ================================================================== */
function yantraMode(recovery) {
  if (recovery == null) return { key: "union", up: 0.8, down: 0.8, petals: 0.6, bhupura: 0.45, speed: 4.2, element: "Anahata · Union", intent: "Find the balance.", bija: "YAM" };
  if (recovery >= 67) return { key: "fire", up: 1, down: 0.16, petals: 1, bhupura: 0.25, speed: 3.0, element: "Agni · Fire", intent: "Rise. Spend the fire.", bija: "RAM" };
  if (recovery >= 34) return { key: "union", up: 0.85, down: 0.85, petals: 0.62, bhupura: 0.45, speed: 4.2, element: "Anahata · Union", intent: "Hold the balance.", bija: "YAM" };
  return { key: "water", up: 0.16, down: 1, petals: 0.32, bhupura: 0.82, speed: 5.6, element: "Apas · Water", intent: "Yield. Restore.", bija: "VAM" };
}

function petalRing(cx, cy, n, ri, ro, wid) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * 360 - 90) * Math.PI / 180;
    const p = a + Math.PI / 2;
    const ax = cx + Math.cos(a) * ri, ay = cy + Math.sin(a) * ri;
    const tx = cx + Math.cos(a) * ro, ty = cy + Math.sin(a) * ro;
    const mr = (ri + ro) / 2, mx = cx + Math.cos(a) * mr, my = cy + Math.sin(a) * mr;
    const lx = mx + Math.cos(p) * wid, ly = my + Math.sin(p) * wid;
    const rx = mx - Math.cos(p) * wid, ry = my - Math.sin(p) * wid;
    out.push(`M${ax.toFixed(1)} ${ay.toFixed(1)} Q${lx.toFixed(1)} ${ly.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} Q${rx.toFixed(1)} ${ry.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}Z`);
  }
  return out;
}

function Cortana({ recovery, size = 84, speaking = false }) {
  const col = recColor(recovery);
  const m = yantraMode(recovery);
  const id = useId().replace(/:/g, "");
  const petals = petalRing(50, 50, 8, 22, 30 + 9 * m.petals, 4 + 3 * m.petals);
  const dur = (speaking ? m.speed * 0.55 : m.speed).toFixed(1) + "s";
  return (
    <div className={`cortana-av yantra-${m.key} ${speaking ? "speaking" : ""}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={`bindu-${id}`} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="42%" stopColor={col} stopOpacity="0.95" />
            <stop offset="100%" stopColor={C.emberDeep} stopOpacity="0.1" />
          </radialGradient>
          <filter id={`glow-${id}`}><feGaussianBlur stdDeviation="2.1" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g filter={`url(#glow-${id})`}>
          <circle className="y-ring" cx="50" cy="50" r="46" fill="none" stroke={col} strokeOpacity="0.4" strokeWidth="0.8" strokeDasharray="2 7" />
          <g stroke={col} fill="none" strokeWidth="0.9" style={{ opacity: m.bhupura }}>
            <rect x="15" y="15" width="70" height="70" />
            <path d="M46 15 h8 v-5 h-8 z M46 85 h8 v5 h-8 z M15 46 v8 h-5 v-8 z M85 46 v8 h5 v-8 z" />
          </g>
          <g className="y-lotus">
            {petals.map((d, i) => <path key={i} d={d} fill={col} fillOpacity={0.06 + 0.1 * m.petals} stroke={col} strokeOpacity="0.4" strokeWidth="0.5" />)}
          </g>
          <g className="y-core" style={{ animationDuration: dur }}>
            <polygon points="50,28 29,64 71,64" fill="none" stroke={col} strokeWidth="1.3" style={{ opacity: m.up }} />
            <polygon points="50,72 29,36 71,36" fill="none" stroke={col} strokeWidth="1.3" style={{ opacity: m.down }} />
          </g>
          <circle className="y-bindu" cx="50" cy="50" r="9" fill={`url(#bindu-${id})`} style={{ animationDuration: dur }} />
        </g>
      </svg>
    </div>
  );
}

/* ================================================================== */
/*  Ambient glyph layer — neon sigils and aphorisms that draw          */
/*  themselves in the dark, then dissolve.                             */
/* ================================================================== */
const GLYPH_QUOTES = [
  "Amor fati.",
  "What stands in the way becomes the way.",
  "We suffer more in imagination than in reality.",
  "Become who you are.",
  "He who has a why can bear almost any how.",
  "Discipline is a form of self-love.",
  "Passion, tempered, becomes power.",
  "Peace is earned each night.",
  "Let the fire serve you.",
  "The wound is where the light enters.",
];

const GLYPH_SHAPES = [
  () => <g><circle cx="50" cy="50" r="30" /><circle cx="40" cy="42" r="2.5" /><circle cx="60" cy="42" r="2.5" /><path d="M38 60 Q50 70 62 60" /></g>,
  () => <path d="M50 75 C20 55 25 28 45 33 C49 34 50 38 50 40 C50 38 51 34 55 33 C75 28 80 55 50 75 Z" />,
  () => <text x="50" y="62" textAnchor="middle" fontSize="34" fontFamily="'JetBrains Mono',monospace">777</text>,
  () => <g><polygon points="50,20 78,70 22,70" /><circle cx="50" cy="53" r="7" /></g>,
  () => <g><polygon points="50,18 76,63 24,63" /><polygon points="50,82 24,37 76,37" /></g>,
  () => <g><circle cx="50" cy="50" r="32" /><polygon points="50,26 71,62 29,62" /><circle cx="50" cy="50" r="5" /></g>,
  () => <path d="M50 50 m0 -2 a2 2 0 1 1 -2 2 a4 4 0 1 1 4 -4 a8 8 0 1 1 -8 8 a14 14 0 1 1 14 -14 a22 22 0 1 1 -22 22 a30 30 0 1 1 30 -30" />,
  () => <g><ellipse cx="50" cy="50" rx="30" ry="17" /><circle cx="50" cy="50" r="7" /><circle cx="50" cy="50" r="2" /></g>,
  () => <path d="M56 18 L34 55 L48 55 L42 82 L68 42 L52 42 Z" />,
  () => <path d="M30 50 C30 38 44 38 50 50 C56 62 70 62 70 50 C70 38 56 38 50 50 C44 62 30 62 30 50 Z" />,
];

function AmbientGlyphs() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    const palette = [C.ember, C.brass, C.steel, C.sage, C.plum];
    const spawn = () => {
      if (!alive) return;
      setItems((cur) => {
        if (cur.length >= 3) return cur;
        const id = uid();
        const life = 9000 + Math.random() * 5000;
        const item = {
          id,
          isQuote: Math.random() < 0.3,
          quote: GLYPH_QUOTES[Math.floor(Math.random() * GLYPH_QUOTES.length)],
          shape: Math.floor(Math.random() * GLYPH_SHAPES.length),
          x: 4 + Math.random() * 82,
          y: 8 + Math.random() * 72,
          size: 70 + Math.random() * 90,
          hue: palette[Math.floor(Math.random() * palette.length)],
          life,
        };
        setTimeout(() => setItems((c) => c.filter((g) => g.id !== id)), life);
        return [...cur, item];
      });
    };
    spawn();
    const iv = setInterval(spawn, 7000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return (
    <div className="ambient" aria-hidden="true">
      {items.map((g) => g.isQuote ? (
        <div key={g.id} className="amb-quote" style={{ left: g.x + "%", top: g.y + "%", color: g.hue, animationDuration: g.life + "ms" }}>{g.quote}</div>
      ) : (
        <svg key={g.id} className="amb-glyph" viewBox="0 0 100 100" style={{ left: g.x + "%", top: g.y + "%", width: g.size, height: g.size, stroke: g.hue, color: g.hue, animationDuration: g.life + "ms" }}>
          {GLYPH_SHAPES[g.shape]()}
        </svg>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Quick log — one-tap entry for the things you do every day.        */
/*  Chips are your own most-used labels, topped up with sane defaults. */
/* ================================================================== */
const QUICK_DEFAULTS = [
  { label: "Coffee", category: "caffeine" },
  { label: "Alcohol", category: "consumption" },
  { label: "Strength", category: "training" },
  { label: "BJJ", category: "training" },
  { label: "Meditation", category: "practice" },
  { label: "Breathwork", category: "practice" },
  { label: "Cold shower", category: "practice" },
];

function QuickLog({ days, setDays }) {
  const [flash, setFlash] = useState("");
  const chips = useMemo(() => {
    const freq = {};
    Object.values(days || {}).forEach((d) => (d.logs || []).forEach((l) => {
      const k = l.label + "|" + l.category;
      freq[k] = (freq[k] || 0) + 1;
    }));
    const used = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 7)
      .map(([k]) => ({ label: k.split("|")[0], category: k.split("|")[1] }));
    const seen = new Set(used.map((c) => c.label.toLowerCase()));
    const merged = [...used];
    for (const d of QUICK_DEFAULTS) if (!seen.has(d.label.toLowerCase()) && merged.length < 9) merged.push(d);
    return merged;
  }, [days]);

  const tap = (c) => {
    const t = new Date();
    const time = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
    const entry = { id: uid(), time, category: c.category, label: c.label, detail: "" };
    const next = { ...days };
    const d = today();
    next[d] = { ...(next[d] || {}), metrics: next[d]?.metrics || {}, logs: [...(next[d]?.logs || []), entry].sort((a, b) => a.time.localeCompare(b.time)) };
    setDays(next);
    setFlash(c.label);
    setTimeout(() => setFlash(""), 1500);
  };

  return (
    <div className="quicklog">
      <span className="quicklog-title">Quick log</span>
      {chips.map((c) => {
        const cc = CATEGORIES[c.category] || CATEGORIES.context;
        const Icon = cc.icon;
        return (
          <button key={c.label + c.category} className="qchip" onClick={() => tap(c)}>
            <Icon size={12} color={cc.color} /> {c.label}
          </button>
        );
      })}
      {flash && <span className="qflash">✓ {flash} logged</span>}
    </div>
  );
}

/* ring + sparkline -------------------------------------------------- */
function Ring({ value, size = 230 }) {
  const stroke = 9, rad = (size - stroke) / 2, circ = 2 * Math.PI * rad;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const off = circ * (1 - pct / 100), col = recColor(value);
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <defs><filter id="glow"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={col} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} filter="url(#glow)"
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }} />
      <text x="50%" y="48%" textAnchor="middle" fill={C.bone} style={{ fontFamily: "Fraunces, serif", fontSize: size * 0.3, fontWeight: 500 }}>{value == null ? "—" : Math.round(value)}</text>
      <text x="50%" y="63%" textAnchor="middle" fill={C.ash} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 3 }}>RECOVERY</text>
    </svg>
  );
}
function Spark({ data, color }) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={34}>
      <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
function Vital({ mkey, value, series }) {
  const m = METRICS[mkey]; const Icon = m.icon;
  let delta = null;
  if (series && series.length >= 4 && value != null) {
    const base = mean(series.slice(0, -1));
    if (base != null) delta = value - base;
  }
  const meaningful = delta != null && Math.abs(delta) >= 0.05;
  const good = !meaningful ? null : m.hi === "up" ? delta > 0 : m.hi === "down" ? delta < 0 : null;
  const dcol = good == null ? C.ash : good ? C.sage : C.ember;
  return (
    <div className="vital">
      <div className="vital-head"><Icon size={13} color={m.color} /><span className="vital-label">{m.label}</span></div>
      <div className="vital-val">{value == null ? "—" : value}<span className="vital-unit">{m.unit}</span>
        {meaningful && <span className="vital-delta" style={{ color: dcol }} title="vs your recent average">{delta > 0 ? "▲" : "▼"}{Math.abs(delta) < 10 ? Math.abs(delta).toFixed(1) : Math.round(Math.abs(delta))}</span>}
      </div>
      <Spark data={series} color={m.color} />
    </div>
  );
}

/* ================================================================== */
/*  Today                                                              */
/* ================================================================== */
function Today({ days, setDays, settings, setSettings }) {
  const dts = useMemo(() => Object.keys(days).sort(), [days]);
  const withData = useMemo(() => dts.filter((d) => {
    const mm = days[d]?.metrics || {};
    return Object.values(mm).some((v) => v != null && v !== "");
  }), [dts, days]);
  const last = withData[withData.length - 1] || dts[dts.length - 1];
  const day = days[last];
  const recent = dts.slice(-14);
  const seriesOf = (k) => recent.map((d) => days[d]?.metrics[k]).filter((v) => v != null);

  const [brief, setBrief] = useState("");
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [asking, setAsking] = useState(false);

  const suggestion = useMemo(() => cortanaSuggestion(days), [days]);

  const generate = useCallback(async () => {
    setLoadingBrief(true); setBrief("");
    const v = VOICES[settings.voice];
    const ctx = compactContext(days, dts.slice(-10));
    const sys = `You are Cortana, the resident intelligence of this person's biometric homebase — a steady, perceptive presence who knows his patterns. ${v.blurb} Speak directly to him in 2 short paragraphs, max ~110 words total. No greetings, no headers, no bullets, no markdown. Reference the actual numbers. End with one concrete directive for today.`;
    const usr = `Today is ${last}. Last 10 days (most recent last):\n${ctx}\n\nGive today's reading and how to move.`;
    try { setBrief(await callClaude(sys, usr)); } catch { setBrief("I can't reach you right now — check the connection and try again."); }
    setLoadingBrief(false);
  }, [days, dts, last, settings.voice]);

  const ask = useCallback(async () => {
    if (!q.trim()) return;
    setAsking(true); setAns("");
    const ctx = compactContext(days, dts.slice(-21));
    const sys = `You are Cortana, a biometric analyst with full access to this person's recent data. Answer plainly and specifically, citing his numbers. 120 words max. No markdown.`;
    try { setAns(await callClaude(sys, `Recent 21 days:\n${ctx}\n\nQuestion: ${q}`)); } catch { setAns("Unreachable right now — try again in a moment."); }
    setAsking(false);
  }, [q, days, dts]);

  if (!day) return <Empty />;
  const m = day.metrics;
  const ym = yantraMode(m.recovery);

  return (
    <div className="today">
      <div className="hero">
        <div className="hero-ring"><Ring value={m.recovery} /></div>
        <div className="hero-body">
          <div className="eyebrow">{pretty(last)}</div>
          <h2 className="hero-title">{m.recovery >= 67 ? "Primed." : m.recovery >= 34 ? "Hold the line." : "Yield today."}</h2>
          <p className="hero-sub">
            {m.recovery >= 67 ? "The body has rebuilt. Spend the surplus deliberately — a day to add load, not to waste."
              : m.recovery >= 34 ? "Reserves are middling. Train, but choose precision over volume, and protect tonight's sleep."
                : "The system is taxed. Restraint now is the disciplined choice. Move lightly, eat well, sleep early."}
          </p>
        </div>
      </div>

      <div className="vitals">
        {["hrv", "rhr", "sleepPerf", "sleepHours", "strain", "respRate"].map((k) => (
          <Vital key={k} mkey={k} value={m[k]} series={seriesOf(k)} />
        ))}
      </div>

      {setDays && <QuickLog days={days} setDays={setDays} />}

      <div className="panel cortana-panel">
        <div className="cortana-top">
          <Cortana recovery={m.recovery} size={84} speaking={loadingBrief || asking} />
          <div className="cortana-intro">
            <div className="cortana-name">CORTANA</div>
            <div className="cortana-yantra"><span>{ym.element}</span><i>{ym.intent}</i></div>
            <p className="cortana-say">{suggestion}</p>
          </div>
        </div>

        <div className="voice-row">
          {Object.entries(VOICES).map(([k, v]) => (
            <button key={k} className={`chip ${settings.voice === k ? "chip-on" : ""}`} onClick={() => setSettings({ ...settings, voice: k })}>{v.name}</button>
          ))}
          <button className="btn" style={{ marginLeft: "auto" }} onClick={generate} disabled={loadingBrief}>
            {loadingBrief ? <Loader size={13} className="spin" /> : <><Sparkles size={13} /> {brief ? "Read again" : "Full reading"}</>}
          </button>
        </div>

        {brief && <p className="brief">{brief}</p>}
        {loadingBrief && <p className="muted">Reading the signal…</p>}

        <div className="ask-row" style={{ marginTop: 14 }}>
          <input className="input" placeholder="Ask Cortana — e.g. what's been costing me my recovery?" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
          <button className="btn" onClick={ask} disabled={asking}>{asking ? <Loader size={13} className="spin" /> : "Ask"}</button>
        </div>
        {ans && <p className="brief" style={{ marginTop: 12 }}>{ans}</p>}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Log (activity / vitals)                                            */
/* ================================================================== */
function Log({ days, setDays }) {
  const [date, setDate] = useState(today());
  const day = days[date] || { metrics: {}, logs: [] };
  const [cat, setCat] = useState("training");
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("12:00");
  const [detail, setDetail] = useState("");
  const [vitals, setVitals] = useState({});

  useEffect(() => { setVitals(days[date]?.metrics || {}); }, [date, days]);

  const addLog = () => {
    if (!label.trim()) return;
    const entry = { id: uid(), time, category: cat, label: label.trim(), detail: detail.trim() };
    const next = { ...days };
    next[date] = { ...(next[date] || {}), metrics: next[date]?.metrics || {}, logs: [...(next[date]?.logs || []), entry].sort((a, b) => a.time.localeCompare(b.time)) };
    setDays(next); setLabel(""); setDetail("");
  };
  const delLog = (id) => { const next = { ...days }; next[date] = { ...next[date], logs: next[date].logs.filter((l) => l.id !== id) }; setDays(next); };
  const saveVitals = () => {
    const cleaned = {};
    Object.entries(vitals).forEach(([k, v]) => { if (v !== "" && v != null && !isNaN(v)) cleaned[k] = Number(v); });
    const next = { ...days };
    next[date] = { ...(next[date] || {}), metrics: cleaned, logs: next[date]?.logs || [] };
    setDays(next);
  };

  return (
    <div className="log">
      <div className="date-bar">
        <button className="btn-ghost" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <input className="input date-in" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <button className="btn-ghost" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()}>›</button>
      </div>
      <QuickLog days={days} setDays={setDays} />
      <div className="log-grid">
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}><Heart size={14} color={C.sage} /> Daily vitals</div>
          <p className="muted" style={{ marginTop: -4, marginBottom: 12 }}>Enter by hand until your band syncs, or correct what it pulled.</p>
          <div className="vital-form">
            {["recovery", "hrv", "rhr", "sleepPerf", "sleepHours", "strain"].map((k) => (
              <label key={k} className="field"><span>{METRICS[k].label}<i>{METRICS[k].unit}</i></span>
                <input className="input" type="number" step="0.1" value={vitals[k] ?? ""} onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })} /></label>
            ))}
          </div>
          <button className="btn btn-wide" onClick={saveVitals}><Check size={13} /> Save vitals</button>
        </div>
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}><Plus size={14} color={C.brass} /> Add to log</div>
          <div className="cat-row">
            {Object.entries(CATEGORIES).map(([k, c]) => { const Icon = c.icon; return (
              <button key={k} className={`cat ${cat === k ? "cat-on" : ""}`} onClick={() => setCat(k)} style={cat === k ? { borderColor: c.color, color: c.color } : {}}><Icon size={13} /> {c.label}</button>
            ); })}
          </div>
          <input className="input" placeholder="What — e.g. Evening yoga, Alcohol, Espresso" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLog()} />
          <div className="ask-row" style={{ marginTop: 8 }}>
            <input className="input" style={{ flex: "0 0 92px" }} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <input className="input" placeholder="Detail (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLog()} />
            <button className="btn" onClick={addLog}>Add</button>
          </div>
          <div className="entries">
            {(day.logs || []).length === 0 && <p className="muted">Nothing logged for {shortD(date)} yet.</p>}
            {(day.logs || []).map((l) => { const c = CATEGORIES[l.category] || CATEGORIES.context; const Icon = c.icon; return (
              <div key={l.id} className="entry"><span className="entry-time">{l.time}</span><Icon size={14} color={c.color} />
                <span className="entry-label">{l.label}{l.detail && <i> · {l.detail}</i>}</span>
                <button className="x" onClick={() => delLog(l.id)}><X size={13} /></button></div>
            ); })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Journal — reflective writing + mood/energy, correlated with data  */
/* ================================================================== */
function Journal({ days, setDays, settings }) {
  const [date, setDate] = useState(today());
  const cur = days[date]?.journal || { text: "", mood: 3, energy: 3 };
  const [text, setText] = useState(cur.text);
  const [mood, setMood] = useState(cur.mood ?? 3);
  const [energy, setEnergy] = useState(cur.energy ?? 3);
  const [saved, setSaved] = useState(false);
  const [reflection, setReflection] = useState("");
  const [reflecting, setReflecting] = useState(false);

  useEffect(() => {
    const j = days[date]?.journal || { text: "", mood: 3, energy: 3 };
    setText(j.text || ""); setMood(j.mood ?? 3); setEnergy(j.energy ?? 3); setSaved(false);
  }, [date, days]);

  const save = () => {
    const next = { ...days };
    next[date] = { ...(next[date] || { metrics: {}, logs: [] }), journal: { text: text.trim(), mood, energy } };
    setDays(next); setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  const dts = useMemo(() => Object.keys(days).sort(), [days]);
  const moodDays = dts.filter((d) => days[d].journal?.mood != null);
  const high = moodDays.filter((d) => days[d].journal.mood >= 4);
  const low = moodDays.filter((d) => days[d].journal.mood <= 2);
  const avgOf = (set, k) => mean(set.map((d) => days[d].metrics[k]).filter((v) => v != null));
  const recHi = avgOf(high, "recovery"), recLo = avgOf(low, "recovery");
  const hrvHi = avgOf(high, "hrv"), hrvLo = avgOf(low, "hrv");

  const reflect = useCallback(async () => {
    setReflecting(true); setReflection("");
    const entries = dts.filter((d) => days[d].journal?.text).slice(-14)
      .map((d) => { const j = days[d].journal, m = days[d].metrics; return `${d} (mood ${j.mood}/5, energy ${j.energy}/5, recovery ${m.recovery}%): ${j.text}`; }).join("\n");
    const v = VOICES[settings.voice];
    const sys = `You are Cortana, this person's biometric and emotional homebase. ${v.blurb} You're looking across his written reflections together with his biometrics to find honest, useful patterns linking how he lives and writes to how his body and mood respond. Name 1–2 real patterns you notice and ONE concrete, positive change worth trying. Speak to him directly, ~130 words, no markdown, no lists.`;
    try { setReflection(await callClaude(sys, `His recent reflections with data:\n${entries || "(no written entries yet)"}\n\nWhat do you notice, and what's one positive change?`)); }
    catch { setReflection("I can't reach you right now — try again shortly."); }
    setReflecting(false);
  }, [days, dts, settings.voice]);

  const recentEntries = dts.filter((d) => days[d].journal?.text).slice(-8).reverse();

  return (
    <div className="journal">
      <div className="log-grid">
        <div className="panel">
          <div className="date-bar" style={{ marginBottom: 14, justifyContent: "flex-start" }}>
            <button className="btn-ghost" onClick={() => setDate(addDays(date, -1))}>‹</button>
            <input className="input date-in" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            <button className="btn-ghost" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()}>›</button>
          </div>
          <div className="slider-block">
            <div className="slider-label"><span>Mood</span><b style={{ color: C.brass }}>{mood}/5</b></div>
            <input className="slider" type="range" min="1" max="5" value={mood} onChange={(e) => setMood(Number(e.target.value))} />
          </div>
          <div className="slider-block">
            <div className="slider-label"><span>Energy</span><b style={{ color: C.steel }}>{energy}/5</b></div>
            <input className="slider" type="range" min="1" max="5" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
          </div>
          <textarea className="input textarea" rows={7} placeholder="How did today actually feel? What moved you, what drained you…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-wide" onClick={save}>{saved ? <><Check size={13} /> Saved</> : <><PenLine size={13} /> Save entry</>}</button>
        </div>

        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 4 }}><Sparkles size={14} color={C.ember} /> Cortana's reflection</div>
          <p className="muted" style={{ marginBottom: 12 }}>She reads your words against your data to find changes worth making.</p>

          <div className="corr-card">
            <div className="corr-stat">
              <span className="corr-stat-k">Recovery on your best days vs hardest</span>
              <span className="corr-stat-v">
                {recHi != null ? recHi.toFixed(0) : "—"}<i>%</i>
                <em>vs</em>
                <b style={{ color: recLo != null && recHi != null && recHi > recLo ? C.sage : C.ash }}>{recLo != null ? recLo.toFixed(0) : "—"}%</b>
              </span>
            </div>
            <div className="corr-stat">
              <span className="corr-stat-k">HRV on your best days vs hardest</span>
              <span className="corr-stat-v">
                {hrvHi != null ? hrvHi.toFixed(0) : "—"}<i>ms</i>
                <em>vs</em>
                <b style={{ color: hrvLo != null && hrvHi != null && hrvHi > hrvLo ? C.sage : C.ash }}>{hrvLo != null ? hrvLo.toFixed(0) : "—"}ms</b>
              </span>
            </div>
          </div>

          <button className="btn btn-accent btn-wide" onClick={reflect} disabled={reflecting}>
            {reflecting ? <Loader size={13} className="spin" /> : <><Sparkles size={13} /> Reflect on my recent entries</>}
          </button>
          {reflection && <p className="brief" style={{ marginTop: 14 }}>{reflection}</p>}
        </div>
      </div>

      {recentEntries.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}><BookOpen size={14} color={C.ash} /> Recent entries</div>
          <div className="entry-list">
            {recentEntries.map((d) => { const j = days[d].journal; return (
              <div key={d} className="jentry">
                <div className="jentry-head"><span className="jentry-date">{pretty(d)}</span>
                  <span className="mood-dots">{[1, 2, 3, 4, 5].map((n) => <span key={n} className="dot" style={{ background: n <= j.mood ? C.brass : C.border }} />)}</span></div>
                <p className="jentry-text">{j.text}</p>
              </div>
            ); })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Experiments                                                       */
/* ================================================================== */
function Experiments({ days, experiments, setExperiments }) {
  const [name, setName] = useState("");
  const [match, setMatch] = useState("");
  const [metricSel, setMetricSel] = useState(["recovery", "hrv"]);
  const [creating, setCreating] = useState(false);

  const allLabels = useMemo(() => {
    const s = new Set();
    Object.values(days).forEach((d) => (d.logs || []).forEach((l) => s.add(l.label)));
    return [...s].sort();
  }, [days]);

  const analyze = useCallback((exp) => {
    const on = [], off = [];
    Object.keys(days).sort().forEach((dt) => {
      const hit = (days[dt].logs || []).some((l) => l.label.toLowerCase() === exp.match.toLowerCase());
      const next = days[addDays(dt, 1)];
      if (!next) return;
      (hit ? on : off).push(next.metrics);
    });
    return exp.metrics.map((mk) => {
      const a = on.map((x) => x[mk]).filter((v) => v != null), b = off.map((x) => x[mk]).filter((v) => v != null);
      const ma = mean(a), mb = mean(b);
      return { mk, n_on: a.length, n_off: b.length, ma, mb, delta: ma != null && mb != null ? ma - mb : null, d: cohenD(a, b) };
    });
  }, [days]);

  const create = () => {
    if (!name.trim() || !match.trim() || metricSel.length === 0) return;
    setExperiments([{ id: uid(), name: name.trim(), match: match.trim(), metrics: metricSel, created: today() }, ...experiments]);
    setName(""); setMatch(""); setMetricSel(["recovery", "hrv"]); setCreating(false);
  };
  const remove = (id) => setExperiments(experiments.filter((e) => e.id !== id));
  const toggleMetric = (k) => setMetricSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  return (
    <div className="exp">
      <div className="exp-intro">
        <h2 className="section-title">n = 1</h2>
        <p className="muted">Pick something you do and watch how it moves you the next morning. The engine compares the days you did it against the days you didn't — the subtle costs and gifts you'd never feel in the moment.</p>
        {!creating && <button className="btn btn-accent" onClick={() => setCreating(true)}><FlaskConical size={14} /> New experiment</button>}
      </div>
      {creating && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Design an experiment</span><button className="x" onClick={() => setCreating(false)}><X size={14} /></button></div>
          <label className="field-block"><span>Name</span><input className="input" placeholder="e.g. Does evening yoga lift my HRV?" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field-block"><span>The thing you do (must match a log label)</span>
            <input className="input" list="labels" placeholder="e.g. Evening yoga" value={match} onChange={(e) => setMatch(e.target.value)} />
            <datalist id="labels">{allLabels.map((l) => <option key={l} value={l} />)}</datalist></label>
          <div className="field-block"><span>Metrics to watch (next morning)</span>
            <div className="cat-row" style={{ marginTop: 6 }}>
              {Object.keys(METRICS).map((k) => (
                <button key={k} className={`cat ${metricSel.includes(k) ? "cat-on" : ""}`} onClick={() => toggleMetric(k)} style={metricSel.includes(k) ? { borderColor: METRICS[k].color, color: METRICS[k].color } : {}}>{METRICS[k].label}</button>
              ))}
            </div></div>
          <button className="btn btn-accent btn-wide" onClick={create}><Check size={13} /> Begin tracking</button>
        </div>
      )}
      {experiments.length === 0 && !creating && (
        <div className="panel"><p className="muted">No experiments yet. A few to steal: <i>Alcohol → next-day recovery</i>, <i>Late caffeine → HRV</i>, <i>Meditation → resting heart rate</i>.</p></div>
      )}
      {experiments.map((exp) => {
        const rows = analyze(exp);
        return (
          <div key={exp.id} className="panel exp-card">
            <div className="panel-head"><span className="panel-title">{exp.name}</span><button className="x" onClick={() => remove(exp.id)}><Trash2 size={13} /></button></div>
            <div className="exp-match">on the days you logged <b style={{ color: C.ember }}>{exp.match}</b></div>
            <div className="exp-rows">
              {rows.map((r) => {
                const m = METRICS[r.mk];
                if (r.delta == null) return <div key={r.mk} className="exp-metric"><span className="exp-mname">{m.label}</span><span className="muted">not enough data yet</span></div>;
                const good = m.hi === "up" ? r.delta > 0 : m.hi === "down" ? r.delta < 0 : null;
                const col = good == null ? C.ash : good ? C.sage : C.ember;
                return (
                  <div key={r.mk} className="exp-metric">
                    <span className="exp-mname" style={{ color: m.color }}>{m.label}</span>
                    <span className="exp-delta" style={{ color: col }}>{r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}{m.unit}</span>
                    <span className="exp-detail">{r.ma.toFixed(1)} vs {r.mb.toFixed(1)} · {r.d != null ? `${dLabel(r.d)} effect` : "—"} · n={r.n_on}/{r.n_off}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Trends                                                            */
/* ================================================================== */
function Trends({ days }) {
  const dts = useMemo(() => Object.keys(days).sort(), [days]);
  const [metric, setMetric] = useState("recovery");
  const m = METRICS[metric];
  const chartData = dts.map((d) => ({ d: shortD(d), v: days[d]?.metrics[metric] }));
  const vals = chartData.map((x) => x.v).filter((v) => v != null);
  const avg = mean(vals);

  const correlations = useMemo(() => {
    const labels = {};
    dts.forEach((dt) => (days[dt].logs || []).forEach((l) => {
      const next = days[addDays(dt, 1)]; if (!next) return;
      (labels[l.label] ||= { on: [], label: l.label }).on.push(next.metrics.recovery);
    }));
    const baseline = mean(dts.map((d) => days[d].metrics.recovery).filter(Boolean));
    return Object.values(labels).filter((x) => x.on.length >= 3)
      .map((x) => ({ label: x.label, n: x.on.length, delta: mean(x.on) - baseline }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 6);
  }, [days, dts]);

  return (
    <div className="trends">
      <div className="metric-tabs">
        {Object.keys(METRICS).map((k) => <button key={k} className={`chip ${metric === k ? "chip-on" : ""}`} onClick={() => setMetric(k)}>{METRICS[k].label}</button>)}
      </div>
      <div className="panel">
        <div className="panel-head"><span className="panel-title">{m.label} · last {dts.length} days</span>{avg != null && <span className="muted">avg {avg.toFixed(1)}{m.unit}</span>}</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={m.color} stopOpacity={0.32} /><stop offset="100%" stopColor={m.color} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke={C.border} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="d" stroke={C.dim} tick={{ fontSize: 10, fill: C.ash }} interval={Math.ceil(dts.length / 8)} tickLine={false} axisLine={{ stroke: C.border }} />
            <YAxis stroke={C.dim} tick={{ fontSize: 10, fill: C.ash }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.bone, fontSize: 12 }} labelStyle={{ color: C.ash }} />
            {avg != null && <ReferenceLine y={avg} stroke={C.dim} strokeDasharray="4 4" />}
            <Area type="monotone" dataKey="v" stroke={m.color} strokeWidth={2} fill="url(#g)" dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 4 }}><TrendingUp size={14} color={C.ember} /> What moves your recovery</div>
        <p className="muted" style={{ marginBottom: 14 }}>Average next-morning recovery after each habit, against your {dts.length}-day baseline.</p>
        <div className="corr">
          {correlations.map((c) => {
            const w = Math.min(100, Math.abs(c.delta) * 4.5), pos = c.delta >= 0;
            return (
              <div key={c.label} className="corr-row">
                <span className="corr-label">{c.label}</span>
                <div className="corr-track"><div className="corr-bar" style={{ width: `${w}%`, marginLeft: pos ? "50%" : `${50 - w / 2}%`, background: pos ? C.sage : C.ember }} /><div className="corr-center" /></div>
                <span className="corr-val" style={{ color: pos ? C.sage : C.ember }}>{pos ? "+" : ""}{c.delta.toFixed(1)}</span>
              </div>
            );
          })}
          {correlations.length === 0 && <p className="muted">Log a few habits and the patterns will surface here.</p>}
        </div>
      </div>
    </div>
  );
}

function Empty() { return <div className="panel" style={{ textAlign: "center", padding: 40 }}><p className="muted">No data yet. Open the Log to record your first day.</p></div>; }

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */
const TABS = [
  { k: "today", label: "Today", icon: Sun },
  { k: "log", label: "Log", icon: BookOpen },
  { k: "journal", label: "Journal", icon: PenLine },
  { k: "exp", label: "Experiments", icon: FlaskConical },
  { k: "trends", label: "Trends", icon: TrendingUp },
];

function MainApp() {
  const [tab, setTab] = useState("today");
  const [days, setDaysState] = useState(null);
  const [experiments, setExperimentsState] = useState([]);
  const [settings, setSettingsState] = useState({ voice: "stoic" });
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    (async () => {
      let data = await loadKey(KEY, null);
      let demo = false;
      if (!data || !data.days || Object.keys(data.days).length === 0) { data = seedData(); demo = true; await saveKey(KEY, data); }
      const exps = await loadKey(EXP, []);
      const set = await loadKey(SET, { voice: "stoic", demo });
      if (demo && set.demo === undefined) set.demo = true;
      setDaysState(data.days); setExperimentsState(exps); setSettingsState(set); setReady(true);
    })();
  }, [version]);

  const setDays = useCallback((d) => { setDaysState(d); saveKey(KEY, { days: d }); }, []);
  const setExperiments = useCallback((e) => { setExperimentsState(e); saveKey(EXP, e); }, []);
  const setSettings = useCallback((s) => { setSettingsState(s); saveKey(SET, s); }, []);

  const clearDemo = async () => {
    const fresh = { days: { [today()]: { metrics: {}, logs: [], journal: { text: "", mood: 3, energy: 3 } } } };
    setDaysState(fresh.days); await saveKey(KEY, fresh);
    const s = { ...settings, demo: false }; setSettingsState(s); await saveKey(SET, s); setTab("log");
  };

  if (!ready) return <div style={{ background: C.obsidian, minHeight: 420, display: "grid", placeItems: "center" }}><Loader className="spin" color={C.ember} /></div>;

  return (
    <div className="app">
      <style>{CSS}</style>
      <AmbientGlyphs />
      <header className="topbar">
        <div className="brand"><span className="brand-mark" /><div><div className="brand-name">Jonathan David Brooks</div><div className="brand-sub">a homebase for the body, mind, and spirit</div></div></div>
        <nav className="nav">
          {TABS.map((t) => { const Icon = t.icon; return (
            <button key={t.k} className={`tab ${tab === t.k ? "tab-on" : ""}`} onClick={() => setTab(t.k)}><Icon size={15} /><span>{t.label}</span></button>
          ); })}
        </nav>
      </header>
      {hasSupabase && <AccountBar onSynced={reload} />}
      {settings.demo && (
        <div className="demo-bar"><span>Sample data — 42 days of realistic readings, mood, and journal entries so Cortana has something to work with. Clear it when your band arrives.</span><button className="btn-link" onClick={clearDemo}>Start fresh ›</button></div>
      )}
      <main className="main">
        {tab === "today" && <Today days={days} setDays={setDays} settings={settings} setSettings={setSettings} />}
        {tab === "log" && <Log days={days} setDays={setDays} />}
        {tab === "journal" && <Journal days={days} setDays={setDays} settings={settings} />}
        {tab === "exp" && <Experiments days={days} experiments={experiments} setExperiments={setExperiments} />}
        {tab === "trends" && <Trends days={days} />}
      </main>
    </div>
  );
}

/* ---- auth + account (only used when Supabase is configured) -------- */
async function authedFetch(path, opts = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message); else setSent(true);
  };
  return (
    <div className="app"><style>{CSS}</style>
      <div className="signin">
        <Cortana recovery={70} size={100} />
        <div className="brand-name" style={{ fontSize: 22, marginTop: 18 }}>Jonathan David Brooks</div>
        <p className="muted" style={{ margin: "8px 0 22px" }}>Your homebase. Sign in with a link — no password.</p>

        {sent ? (
          <p className="brief" style={{ textAlign: "center" }}>Check your email for a sign-in link, then return here.</p>
        ) : (
          <div className="signin-form">
            <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="btn btn-accent btn-wide" onClick={send} disabled={!email.trim()}>Send link</button>
            {err && <p className="muted" style={{ color: C.ember }}>{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountBar({ onSynced }) {
  const [email, setEmail] = useState("");
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
    authedFetch("/api/whoop/status").then((r) => r.json()).then((d) => { setConnected(!!d.connected); setLastSync(d.lastSync); }).catch(() => {});
    const p = new URLSearchParams(window.location.search).get("whoop");
    if (p === "connected") { setMsg("WHOOP connected. Syncing…"); sync(); window.history.replaceState({}, "", window.location.pathname); }
    if (p === "error") setMsg("WHOOP connection failed — try again.");
  }, []);

  const connect = async () => {
    const r = await authedFetch("/api/whoop/login", { method: "POST" });
    const d = await r.json();
    if (d.url) window.location.href = d.url; else setMsg(d.error || "Could not start WHOOP connection.");
  };
  const sync = async () => {
    setSyncing(true); setMsg("");
    try {
      const r = await authedFetch("/api/whoop/sync", { method: "POST" });
      const d = await r.json();
      if (d.error) setMsg(d.error);
      else { setMsg(`Synced ${d.days ?? 0} day(s) from WHOOP.`); setConnected(true); setLastSync(new Date().toISOString()); onSynced && onSynced(); }
    } catch { setMsg("Sync failed — try again."); }
    setSyncing(false);
  };
  const signOut = async () => { await supabase.auth.signOut(); window.location.reload(); };

  return (
    <div className="account-bar">
      <span className="acct-email">{email}</span>
      <div className="acct-actions">
        {msg && <span className="acct-msg">{msg}</span>}
        {connected
          ? <button className="btn-link" onClick={sync} disabled={syncing}>{syncing ? "Syncing…" : "Sync WHOOP"}</button>
          : <button className="btn-link" onClick={connect}>Connect WHOOP</button>}
        <button className="btn-link" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div style={{ background: C.obsidian, minHeight: 420, display: "grid", placeItems: "center" }}><Loader className="spin" color={C.ember} /></div>;
  if (!session) return <SignIn />;
  return children;
}

export default function App() {
  return hasSupabase ? <AuthGate><MainApp /></AuthGate> : <MainApp />;
}

/* ================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
* { box-sizing:border-box; }
.app { background:${C.obsidian}; color:${C.bone}; font-family:Inter,system-ui,sans-serif; min-height:100%; line-height:1.5;
  background-image:radial-gradient(120% 80% at 50% -10%, rgba(194,69,59,0.07), transparent 60%); }
.app button { cursor:pointer; font-family:inherit; }
.spin { animation:spin 1s linear infinite; } @keyframes spin { to { transform:rotate(360deg); } }

.topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:18px 22px; border-bottom:1px solid ${C.border}; }
.brand { display:flex; align-items:center; gap:12px; }
.brand-mark { width:10px; height:34px; background:linear-gradient(${C.ember},${C.emberDeep}); border-radius:2px; box-shadow:0 0 14px rgba(194,69,59,.5); }
.brand-name { font-family:Fraunces,serif; font-weight:600; letter-spacing:1px; font-size:17px; }
.brand-sub { font-size:11px; color:${C.ash}; letter-spacing:.4px; }
.nav { display:flex; gap:4px; flex-wrap:wrap; }
.tab { display:flex; align-items:center; gap:7px; background:transparent; border:1px solid transparent; color:${C.ash}; padding:8px 13px; border-radius:9px; font-size:13px; font-weight:500; transition:.15s; }
.tab:hover { color:${C.bone}; background:${C.panel}; }
.tab-on { color:${C.bone}; background:${C.panel2}; border-color:${C.border}; }

.demo-bar { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:9px 22px; background:rgba(196,154,74,.08); border-bottom:1px solid ${C.border}; font-size:12px; color:${C.brass}; }
.btn-link { background:none; border:none; color:${C.brass}; font-weight:600; font-size:12px; cursor:pointer; }
.btn-link:disabled { opacity:.55; }
.account-bar { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:8px 22px; background:${C.panel}; border-bottom:1px solid ${C.border}; font-size:12px; }
.acct-email { color:${C.ash}; font-family:'JetBrains Mono',monospace; }
.acct-actions { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
.acct-msg { color:${C.sage}; }
.signin { max-width:380px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; }
.signin-form { width:100%; display:flex; flex-direction:column; gap:10px; }
.main { padding:22px; max-width:960px; margin:0 auto; }

.panel { background:${C.panel}; border:1px solid ${C.border}; border-radius:14px; padding:18px; margin-bottom:16px; }
.panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:10px; }
.panel-title { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; letter-spacing:.4px; color:${C.bone}; text-transform:uppercase; }
.muted { color:${C.ash}; font-size:13px; }
.muted i { color:${C.dim}; font-style:italic; }
.section-title { font-family:Fraunces,serif; font-size:30px; font-weight:500; margin:0 0 6px; }

.today .hero { display:flex; gap:28px; align-items:center; flex-wrap:wrap; background:${C.panel}; border:1px solid ${C.border}; border-radius:18px; padding:26px; margin-bottom:16px; }
.hero-ring { flex:0 0 auto; margin:0 auto; }
.hero-body { flex:1 1 280px; min-width:240px; }
.eyebrow { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:2px; color:${C.ash}; text-transform:uppercase; }
.hero-title { font-family:Fraunces,serif; font-size:34px; font-weight:500; margin:6px 0 10px; }
.hero-sub { color:${C.ash}; font-size:14px; max-width:46ch; margin:0; }

.vitals { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:16px; }
.vital { background:${C.panel}; border:1px solid ${C.border}; border-radius:12px; padding:12px; }
.vital-head { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
.vital-label { font-size:10.5px; color:${C.ash}; letter-spacing:.5px; text-transform:uppercase; }
.vital-val { font-family:'JetBrains Mono',monospace; font-size:21px; font-weight:500; color:${C.bone}; }
.vital-unit { font-size:11px; color:${C.dim}; margin-left:2px; }

/* Cortana */
.cortana-panel { background:linear-gradient(${C.panel}, ${C.panel2}); }
.cortana-top { display:flex; gap:16px; align-items:center; margin-bottom:14px; }
.cortana-av { flex:0 0 auto; }
.cortana-intro { flex:1; }
.cortana-name { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:4px; color:${C.ember}; margin-bottom:4px; }
.cortana-yantra { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-bottom:6px; }
.cortana-yantra span { font-size:12px; color:${C.brass}; font-weight:600; letter-spacing:.3px; }
.cortana-yantra i { font-size:12px; color:${C.ash}; font-style:italic; }
.cortana-say { font-size:14.5px; line-height:1.6; color:${C.bone}; margin:0; }
.y-ring { transform-origin:50px 50px; animation:spin 30s linear infinite; }
.y-lotus { transform-origin:50px 50px; animation:spin 64s linear infinite reverse; }
.cortana-av.speaking .y-lotus { animation-duration:26s; }
.y-core { transform-origin:50px 50px; animation:breathe 4s ease-in-out infinite; }
.y-bindu { transform-origin:50px 50px; animation:pulse 3.4s ease-in-out infinite; }
@keyframes breathe { 0%,100% { transform:scale(1); opacity:.85; } 50% { transform:scale(1.06); opacity:1; } }
@keyframes pulse { 0%,100% { transform:scale(.92); opacity:.85; } 50% { transform:scale(1.08); opacity:1; } }

.voice-row { display:flex; gap:7px; flex-wrap:wrap; align-items:center; margin-bottom:6px; }
.chip { background:${C.panel2}; border:1px solid ${C.border}; color:${C.ash}; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:500; transition:.15s; }
.chip:hover { color:${C.bone}; }
.chip-on { background:${C.ember}; border-color:${C.ember}; color:#fff; }
.brief { font-size:14.5px; line-height:1.65; color:${C.bone}; white-space:pre-wrap; margin:12px 0 0; }

.btn { display:inline-flex; align-items:center; gap:6px; background:${C.panel2}; border:1px solid ${C.border}; color:${C.bone}; padding:8px 14px; border-radius:9px; font-size:13px; font-weight:500; transition:.15s; }
.btn:hover:not(:disabled) { border-color:${C.ash}; }
.btn:disabled { opacity:.55; cursor:default; }
.btn-accent { background:${C.ember}; border-color:${C.ember}; color:#fff; }
.btn-accent:hover:not(:disabled) { background:${C.emberDeep}; border-color:${C.emberDeep}; }
.btn-wide { width:100%; justify-content:center; margin-top:12px; }
.btn-ghost { background:transparent; border:1px solid ${C.border}; color:${C.ash}; width:38px; height:38px; border-radius:9px; font-size:18px; }
.btn-ghost:disabled { opacity:.4; }
.input { background:${C.obsidian}; border:1px solid ${C.border}; color:${C.bone}; padding:9px 12px; border-radius:9px; font-size:13px; font-family:inherit; width:100%; outline:none; transition:.15s; }
.input:focus { border-color:${C.ash}; }
.textarea { resize:vertical; line-height:1.6; }
.ask-row { display:flex; gap:8px; align-items:center; }
.ask-row .input { flex:1; }

.date-bar { display:flex; align-items:center; gap:8px; justify-content:center; margin-bottom:16px; }
.date-in { width:auto; text-align:center; }
.log-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
.vital-form { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.field { display:flex; flex-direction:column; gap:5px; font-size:11px; color:${C.ash}; }
.field span { display:flex; justify-content:space-between; text-transform:uppercase; letter-spacing:.4px; }
.field i { color:${C.dim}; font-style:normal; }
.field-block { display:block; margin-bottom:12px; }
.field-block > span { display:block; font-size:11px; color:${C.ash}; text-transform:uppercase; letter-spacing:.4px; margin-bottom:6px; }
.cat-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.cat { display:inline-flex; align-items:center; gap:5px; background:${C.panel2}; border:1px solid ${C.border}; color:${C.ash}; padding:6px 10px; border-radius:8px; font-size:12px; font-weight:500; }
.cat-on { background:${C.obsidian}; }
.entries { margin-top:14px; display:flex; flex-direction:column; gap:2px; }
.entry { display:flex; align-items:center; gap:9px; padding:8px 6px; border-bottom:1px solid ${C.border}; }
.entry:last-child { border-bottom:none; }
.entry-time { font-family:'JetBrains Mono',monospace; font-size:11px; color:${C.dim}; width:40px; }
.entry-label { flex:1; font-size:13px; }
.entry-label i { color:${C.ash}; font-style:normal; font-size:12px; }
.x { background:none; border:none; color:${C.dim}; padding:3px; border-radius:6px; display:flex; }
.x:hover { color:${C.ember}; }

/* journal sliders + correlation */
.slider-block { margin-bottom:14px; }
.slider-label { display:flex; justify-content:space-between; font-size:12px; color:${C.ash}; text-transform:uppercase; letter-spacing:.4px; margin-bottom:7px; }
.slider { -webkit-appearance:none; appearance:none; width:100%; height:5px; border-radius:3px; background:${C.border}; outline:none; }
.slider::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:${C.bone}; border:3px solid ${C.ember}; cursor:pointer; }
.slider::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:${C.bone}; border:3px solid ${C.ember}; cursor:pointer; }
.corr-card { background:${C.obsidian}; border:1px solid ${C.border}; border-radius:10px; padding:14px; margin-bottom:14px; }
.corr-stat { display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:7px 0; border-bottom:1px solid ${C.border}; }
.corr-stat:last-child { border-bottom:none; }
.corr-stat-k { font-size:12px; color:${C.ash}; }
.corr-stat-v { font-family:'JetBrains Mono',monospace; font-size:18px; color:${C.bone}; display:flex; align-items:baseline; gap:6px; }
.corr-stat-v i { font-size:11px; color:${C.dim}; margin-left:-3px; }
.corr-stat-v em { font-size:10px; color:${C.dim}; font-style:normal; letter-spacing:1px; }
.entry-list { display:flex; flex-direction:column; gap:14px; }
.jentry { border-left:2px solid ${C.border}; padding-left:14px; }
.jentry-head { display:flex; align-items:center; gap:10px; margin-bottom:5px; }
.jentry-date { font-size:12px; color:${C.ash}; font-family:'JetBrains Mono',monospace; }
.mood-dots { display:flex; gap:3px; }
.dot { width:7px; height:7px; border-radius:50%; }
.jentry-text { font-size:14px; color:${C.bone}; margin:0; line-height:1.6; }

.exp-intro { margin-bottom:18px; } .exp-intro .muted { max-width:60ch; margin-bottom:14px; }
.exp-match { font-size:13px; color:${C.ash}; margin-bottom:14px; }
.exp-rows { display:flex; flex-direction:column; gap:12px; }
.exp-metric { display:grid; grid-template-columns:120px 90px 1fr; align-items:baseline; gap:10px; padding-bottom:10px; border-bottom:1px solid ${C.border}; }
.exp-metric:last-child { border-bottom:none; padding-bottom:0; }
.exp-mname { font-size:13px; font-weight:600; }
.exp-delta { font-family:'JetBrains Mono',monospace; font-size:20px; font-weight:500; }
.exp-detail { font-size:11.5px; color:${C.ash}; font-family:'JetBrains Mono',monospace; }

.metric-tabs { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:16px; }
.corr { display:flex; flex-direction:column; gap:11px; }
.corr-row { display:grid; grid-template-columns:130px 1fr 52px; align-items:center; gap:12px; }
.corr-label { font-size:13px; }
.corr-track { position:relative; height:8px; background:${C.panel2}; border-radius:4px; }
.corr-bar { position:absolute; top:0; height:8px; border-radius:4px; transition:width .6s; }
.corr-center { position:absolute; left:50%; top:-3px; width:1px; height:14px; background:${C.dim}; }
.corr-val { font-family:'JetBrains Mono',monospace; font-size:14px; text-align:right; }

/* ambient glyph layer */
.ambient { position:fixed; inset:0; pointer-events:none; z-index:0; overflow:hidden; }
.topbar, .account-bar, .demo-bar, .main, .signin { position:relative; z-index:1; }
.amb-glyph { position:absolute; fill:none; stroke-width:1.4; opacity:0;
  filter:drop-shadow(0 0 7px currentColor);
  stroke-dasharray:420; stroke-dashoffset:420;
  animation-name:glyphlife; animation-timing-function:ease-in-out; animation-fill-mode:forwards; }
.amb-glyph text { fill:none; stroke-width:1; }
@keyframes glyphlife {
  0% { opacity:0; stroke-dashoffset:420; transform:translateY(8px); }
  18% { opacity:.15; }
  55% { stroke-dashoffset:0; opacity:.15; }
  80% { opacity:.11; }
  100% { opacity:0; stroke-dashoffset:0; transform:translateY(-12px); }
}
.amb-quote { position:absolute; font-family:Fraunces,serif; font-style:italic; font-size:15px; opacity:0; max-width:260px; line-height:1.5;
  text-shadow:0 0 14px currentColor; animation-name:quotelife; animation-timing-function:ease-in-out; animation-fill-mode:forwards; }
@keyframes quotelife { 0% { opacity:0; transform:translateY(8px); } 20% { opacity:.24; } 75% { opacity:.18; } 100% { opacity:0; transform:translateY(-8px); } }

/* quick log */
.quicklog { display:flex; align-items:center; gap:7px; flex-wrap:wrap; background:${C.panel}; border:1px solid ${C.border}; border-radius:12px; padding:10px 14px; margin-bottom:16px; }
.quicklog-title { font-size:10.5px; color:${C.ash}; letter-spacing:1.5px; text-transform:uppercase; margin-right:4px; }
.qchip { display:inline-flex; align-items:center; gap:6px; background:${C.panel2}; border:1px solid ${C.border}; color:${C.bone}; padding:6px 11px; border-radius:18px; font-size:12px; font-weight:500; transition:.15s; }
.qchip:hover { border-color:${C.ash}; transform:translateY(-1px); }
.qchip:active { transform:scale(.95); }
.qflash { font-size:12px; color:${C.sage}; }
.vital-delta { font-size:10.5px; margin-left:6px; font-family:'JetBrains Mono',monospace; }

@media (max-width:760px) {
  .vitals { grid-template-columns:repeat(3,1fr); }
  .log-grid { grid-template-columns:1fr; }
  .brand-sub { display:none; }
  .tab span { display:none; }
  .tab { padding:9px 11px; }
  .exp-metric { grid-template-columns:1fr auto; }
  .exp-detail { grid-column:1 / -1; }
}
`;
