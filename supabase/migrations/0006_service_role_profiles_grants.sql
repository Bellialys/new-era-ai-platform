-- The backend may need to read or maintain profiles with the server-only
-- service_role key. Explicit table privileges are still required even though
-- service_role bypasses RLS.

grant select, insert, update on public.profiles to service_role;
