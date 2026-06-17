-- Migration: anonymous_sessions
-- v0.6.1 — Guest Mode foundation
-- Creates anonymous_sessions table for guest users

create table if not exists public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  avatar_seed text not null,
  color_seed text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  converted_user_id uuid references auth.users(id) on delete set null
);

comment on table public.anonymous_sessions is
  'Guest sessions for users who chose "Continue as guest" mode. '
  'Each row represents one anonymous visitor with a generated display name.';

comment on column public.anonymous_sessions.converted_user_id is
  'Set when the guest later creates an account, allowing history migration.';

-- Enable RLS: all access goes through service_role on the backend.
-- Anon users have no direct access to this table.
alter table public.anonymous_sessions enable row level security;

-- Service role has full access (our backend uses service_role key)
create policy "Service role full access on anonymous_sessions"
  on public.anonymous_sessions
  for all
  to service_role
  using (true)
  with check (true);

-- Index: last_seen_at for cleanup jobs (future)
create index if not exists anonymous_sessions_last_seen_at_idx
  on public.anonymous_sessions (last_seen_at);

-- Index: converted_user_id for account linking (v0.6+)
create index if not exists anonymous_sessions_converted_user_id_idx
  on public.anonymous_sessions (converted_user_id)
  where converted_user_id is not null;
