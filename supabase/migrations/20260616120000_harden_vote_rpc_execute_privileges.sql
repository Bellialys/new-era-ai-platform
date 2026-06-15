-- Harden execute/table privileges for the atomic "best" vote path.
--
-- Context: 20260615120000_atomic_best_vote_rpc.sql created public.cast_best_vote
-- as `security definer` and revoked EXECUTE from public/anon/authenticated, but
-- it never granted EXECUTE to service_role explicitly — execution relied on
-- Supabase's implicit default privileges. Likewise public.votes has an RLS
-- policy for service_role but no table-level GRANT, even though (per
-- 0006_service_role_profiles_grants.sql) explicit table privileges are still
-- required even when service_role bypasses RLS.
--
-- This migration makes the contract self-contained without changing behaviour:
--   * keep cast_best_vote as `security definer` + `set search_path = public`
--     (the function is invoked only by the server-side service-role client and
--     is already off public/anon/authenticated RPC);
--   * grant EXECUTE explicitly to service_role so the call never depends on
--     fragile implicit defaults;
--   * grant the table privileges the function needs (select/insert/delete on
--     votes), which also makes a future switch to `security invoker` safe;
--   * re-assert the revoke so a later CREATE OR REPLACE cannot silently
--     re-expose the function to untrusted roles.
--
-- All statements are idempotent.

-- Lock the RPC to the backend only (re-assert after any function rebuild).
revoke execute on function public.cast_best_vote(uuid, uuid, uuid, text)
  from public, anon, authenticated;

-- Explicitly allow the server-side service-role client to call it.
grant execute on function public.cast_best_vote(uuid, uuid, uuid, text)
  to service_role;

-- Explicit table privileges the RPC body needs (replace-previous + insert).
grant select, insert, delete on public.votes to service_role;
