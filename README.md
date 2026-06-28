# Vital Signs

A personal biometric homebase — recovery, sleep, strain, training, mood, journaling, n=1 experiments, and **Cortana**, an AI presence that reads your data and reflects with you.

Vite + React frontend, Vercel serverless functions, Supabase for login + storage, WHOOP for automatic biometric sync.

---

## How it fits together

```
src/App.jsx              the whole dashboard
src/lib/supabase.js      browser Supabase client (login)
src/lib/store.js         data layer — Supabase when configured, else browser-local
api/cortana.js           secure proxy to the Anthropic API (Cortana's brain)
api/whoop/*.js           WHOOP OAuth + sync
api/_lib/*.js            shared serverless helpers
supabase/schema.sql      database tables + security policies
public/                  PWA manifest, icons, service worker
```

Two modes, decided automatically by whether the Supabase env vars are set:

- **Synced mode** (recommended): login + Postgres, so web and phone share one dataset, and WHOOP can sync in.
- **Local mode**: no env needed, data lives in the browser. Useful for a quick look before setup.

---

## Setup (synced mode — web + phone + WHOOP)

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and **Run**. That creates the tables and security rules.
3. **Authentication → Providers → Email**: make sure email is enabled (magic links are on by default).
4. From **Project Settings → API**, copy three values for later:
   - Project URL
   - `anon` public key
   - `service_role` key (secret — server only)

### 2. WHOOP app
1. At [developer.whoop.com](https://developer.whoop.com), create an app.
2. Set the **Redirect URL** to `https://YOUR-APP.vercel.app/api/whoop/callback` (you'll know the real domain after the first Vercel deploy — come back and set it then).
3. Copy the **Client ID** and **Client Secret**.
4. (Optional, for automatic morning sync) add a **Webhook URL** of `https://YOUR-APP.vercel.app/api/whoop/sync` with model version **v2**.

### 3. Deploy on Vercel
1. Push this folder to a GitHub repo:
   ```bash
   git init && git add . && git commit -m "Vital Signs"
   git branch -M main
   git remote add origin https://github.com/YOU/vital-signs.git
   git push -u origin main
   ```
2. At [vercel.com](https://vercel.com) → **Add New → Project** → import the repo (it auto-detects Vite).
3. Add **Environment Variables** (see `.env.example` for the full list):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REDIRECT_URI`, `APP_URL`
4. Deploy. Then go back to WHOOP and set the real Redirect URL to your live `…vercel.app/api/whoop/callback`, and set `WHOOP_REDIRECT_URI` + `APP_URL` in Vercel to match. Redeploy once.

### 4. Use it
- Open your URL → sign in with the email link.
- Click **Connect WHOOP** in the account bar → authorize → it returns and syncs.
- After that, **Sync WHOOP** pulls the latest, and (if you set the webhook) new data flows in each morning automatically.

---

## Phone

Once it's live over HTTPS: open the URL in Safari → **Share → Add to Home Screen**. The manifest, icons, and service worker here make it install as a full-screen app, signed into the same Supabase account, same data.

---

## Cortana

Runs on your own Anthropic key via `api/cortana.js`, so the key never reaches the browser. A few cents a day at normal use. Override her model with a `CORTANA_MODEL` env var.

---

## Notes worth reading once

- **HRV / field mapping.** `api/whoop/sync.js` maps WHOOP's v2 recovery/sleep/cycle fields into your metrics. These shapes are stable but occasionally vary by account; after your first sync, glance at a day's numbers and, if HRV or sleep duration looks off, adjust the mapping there (it's commented).
- **Rotating refresh tokens.** WHOOP issues a new refresh token on every refresh and invalidates the old one. The token helper saves the new pair immediately. Fine for one user; a multi-user version would add a per-user lock.
- **Webhook signatures.** The webhook handler accepts WHOOP posts as-is. For production hardening, add WHOOP's webhook signature verification in `api/whoop/sync.js`.
- **Merge safety.** WHOOP sync only ever merges into each day's `metrics`, never touching your logs or journal.

## Local development

```bash
npm install
cp .env.example .env     # fill in values
npx vercel dev           # runs the frontend AND the serverless functions
```
(`npm run dev` runs the UI alone but not the `/api` functions, so Cortana and WHOOP won't respond.)

## Netlify instead of Vercel
Move `api/*` to `netlify/functions/*`, adjust the call paths, and set the same env vars. Vercel is the smoother path here because of the zero-config `/api` + Vite combination.
