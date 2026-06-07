-- The server-side Supabase client uses the service_role key to read the v0.5
-- model catalog. It still needs explicit table privileges.

grant select on public.models to service_role;
