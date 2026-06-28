# Jonathan David Brooks — Dashboard Guide

Two parts: **how to use it**, then **how to put it on the web**.

---

# Part 1 — Using the dashboard

The app has five tabs across the top: **Today, Log, Journal, Experiments, Trends.** It opens loaded with 42 days of sample data so nothing is empty while you learn it. Clear that anytime with **Start fresh** in the amber bar (do this once your WHOOP band is feeding real data).

## Today
Your morning read.
- **The recovery ring** is the headline number — green (primed), amber (middling), red (taxed).
- **The vitals row** shows HRV, resting heart rate, sleep, strain, and respiratory rate, each with a 14-day sparkline.
- **Cortana** sits below as a living yantra. Her geometry shifts with your state — ascending fire when you're primed, the balanced shatkona mid-range, descending water when you're depleted — and the line beside her names the element and the intention for the day.
  - **Voice registers** (Stoic / Operator / Coach) change how she speaks. Tap one.
  - **Full reading** asks Cortana to read your last ten days and set a directive.
  - **Ask Cortana** — type any question about your data ("what's been costing me recovery?") and she answers from your numbers.

## Log
Where the raw inputs go.
- **Daily vitals** — enter recovery, HRV, RHR, sleep, strain by hand (until WHOOP syncs them), then **Save vitals**. Use the date arrows to log a past day.
- **Add to log** — record what you did across six categories (Training, Practice, Food, Consumption, Caffeine, Context). Pick a category, name it, set a time, **Add**. These labels are what the experiments and correlations run on, so be consistent (e.g. always "Evening yoga").

## Journal
The reflective space.
- Set **Mood** and **Energy** (1–5) with the sliders, write the entry, **Save**.
- The **correlation card** shows your recovery and HRV on your best days versus your hardest.
- **Reflect on my recent entries** has Cortana read your words against your biometrics and name one concrete change worth making.

## Experiments (n = 1)
Test how a single habit changes you.
1. **New experiment** → name it, point it at a log label you actually use (e.g. "Alcohol"), and pick the metrics to watch.
2. It compares your **next-morning** numbers on the days you did the thing against the days you didn't — showing the difference, the effect size, and how many days are in each group.
3. Effects firm up as you log more. Three to steal: Alcohol → recovery, Late caffeine → HRV, Meditation → resting heart rate.

## Trends
- Pick any metric to chart it over time against its average.
- **What moves your recovery** auto-ranks your habits by their average next-morning effect — the quiet costs and gifts you'd never feel in the moment.

## Your account (once deployed with login)
A bar under your name shows your email, **Connect WHOOP**, **Sync WHOOP**, and **Sign out**. Connect once; after that, syncing pulls the latest readings (or they arrive automatically each morning if you set the webhook).

---

# Part 2 — Deploying it as a web app

You'll create free accounts on five services. Work top to bottom; it takes about 30–45 minutes the first time.

### What you'll need
- [Node.js](https://nodejs.org) 18+ installed (only for the optional local test).
- Accounts: **GitHub**, **Vercel**, **Supabase**, **Anthropic**, **WHOOP** (developer).
- The project folder (unzip `vital-signs.zip`).

### Step 1 — Supabase (login + your data)
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste everything from `supabase/schema.sql`, **Run**.
3. **Authentication → Providers** → confirm **Email** is enabled.
4. **Project Settings → API** → copy three values: **Project URL**, **anon public key**, **service_role key** (keep the service_role one secret).

### Step 2 — Anthropic (Cortana's brain)
1. At [console.anthropic.com](https://console.anthropic.com), create an **API key**. Copy it.

### Step 3 — GitHub (host the code)
From the unzipped folder:
```bash
git init && git add . && git commit -m "Dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dashboard.git
git push -u origin main
```
(Create the empty repo on github.com first to get that URL.)

### Step 4 — Vercel (put it online)
1. [vercel.com](https://vercel.com) → **Add New → Project** → import your repo. Leave build settings as detected (Vite).
2. Add **Environment Variables** (Settings → Environment Variables) — these names matter exactly:
   - `VITE_SUPABASE_URL` = Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase anon key
   - `SUPABASE_URL` = same Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service_role key
   - `ANTHROPIC_API_KEY` = your Anthropic key
3. **Deploy.** You'll get a live URL like `https://your-app.vercel.app`.

At this point login and Cortana work. Open the URL, sign in with the email link, and you're in. WHOOP is the last step.

### Step 5 — WHOOP (automatic biometrics)
1. At [developer.whoop.com](https://developer.whoop.com), create an app.
2. Set its **Redirect URL** to `https://your-app.vercel.app/api/whoop/callback` (your real Vercel domain).
3. (Optional) add a **Webhook URL** of `https://your-app.vercel.app/api/whoop/sync`, model version **v2**, for automatic morning syncs.
4. Copy the **Client ID** and **Client Secret**.
5. Back in Vercel, add four more env vars, then **redeploy**:
   - `WHOOP_CLIENT_ID`
   - `WHOOP_CLIENT_SECRET`
   - `WHOOP_REDIRECT_URI` = `https://your-app.vercel.app/api/whoop/callback`
   - `APP_URL` = `https://your-app.vercel.app`
6. Open the app → **Connect WHOOP** → authorize → it returns and syncs.

### Step 6 — Phone
Open your URL in Safari → **Share → Add to Home Screen.** It installs as a full-screen app, same login, same data.

---

### If something doesn't work
- **Cortana buttons do nothing** → `ANTHROPIC_API_KEY` missing or misspelled in Vercel.
- **Can't sign in** → check `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, and that you ran `schema.sql`.
- **WHOOP won't connect** → the Redirect URL in the WHOOP dashboard must match `WHOOP_REDIRECT_URI` exactly, character for character.
- **Numbers look off after first WHOOP sync** → adjust the field mapping in `api/whoop/sync.js` (it's commented, including the HRV unit).

Every `git push` redeploys automatically.
