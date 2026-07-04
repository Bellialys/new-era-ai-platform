-- Allow the server-side service-role client to persist best votes through
-- the SECURITY INVOKER cast_best_vote RPC.

grant select, insert, update, delete on public.votes to service_role;
