-- Vital Signs — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- 1) App data, one row per (user, key). The app stores its whole state in a few keys.
create table if not exists public.app_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.app_state enable row level security;

-- Each user can only read/write their own rows.
create policy "own rows - select" on public.app_state
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.app_state
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on public.app_state
  for delete using (auth.uid() = user_id);

-- 2) WHOOP tokens. Written/read only by serverless functions (service role).
--    RLS is ON with NO policies, so the browser (anon/authenticated) cannot touch it.
create table if not exists public.whoop_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whoop_user_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  last_sync timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.whoop_tokens enable row level security;
create index if not exists whoop_tokens_whoop_user_id_idx on public.whoop_tokens (whoop_user_id);

-- 3) Short-lived OAuth state for CSRF protection. Service role only.
create table if not exists public.whoop_oauth_state (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.whoop_oauth_state enable row level security;
