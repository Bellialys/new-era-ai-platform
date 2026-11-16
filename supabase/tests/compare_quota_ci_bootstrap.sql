-- CI-only minimal host schema for the quota RPC migration.
-- Safe fixture for a transient PostgreSQL 17 service in GitHub Actions.
-- Never execute this in production: the live profiles/tasks schema is richer.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.profiles (
  id uuid primary key,
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','pro'))
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  anonymous_session_id text,
  mode_slug text not null,
  created_at timestamptz not null default clock_timestamp()
);
