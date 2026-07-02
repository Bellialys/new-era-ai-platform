-- The backend guest-session route uses the server-only service_role client.
-- RLS policy alone is not enough: Postgres still requires table privileges.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.anonymous_sessions to service_role;

-- Guest sessions remain server-managed only.
revoke all on table public.anonymous_sessions from anon, authenticated;
