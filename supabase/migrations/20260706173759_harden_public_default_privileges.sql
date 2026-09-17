-- Harden default privileges for future objects created by the application
-- migration role in the exposed public schema.
--
-- This migration intentionally does not change existing table/function grants.
-- Existing Data API access remains explicit and is still protected by RLS.

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, public;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, public;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

-- PostgreSQL grants EXECUTE on future functions to PUBLIC by default at the
-- global default-privilege level. A schema-scoped revoke cannot remove that.
alter default privileges for role postgres
  revoke execute on functions from public;
