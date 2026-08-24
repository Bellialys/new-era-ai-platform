import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824204614_atomic_admin_mutations_and_last_admin_guard.sql"
  ),
  "utf8"
).toLowerCase();

describe("atomic admin mutation migration", () => {
  it.each([
    "admin_update_user_with_audit",
    "admin_update_model_with_audit",
  ])("keeps %s security-invoker and service-role-only", (functionName) => {
    expect(migration).toContain(`create or replace function public.${functionName}`);
    expect(migration).toContain("security invoker");
    expect(migration).toContain(
      `revoke execute on function public.${functionName}(uuid, uuid, jsonb) from public, anon, authenticated`
    );
    expect(migration).toContain(
      `grant execute on function public.${functionName}(uuid, uuid, jsonb) to service_role`
    );
  });

  it("puts both protected updates and audit inserts inside the RPC migration", () => {
    expect(migration).toContain("update public.profiles");
    expect(migration).toContain("update public.models");
    expect(migration.match(/insert into public\.audit_log/g)).toHaveLength(2);
  });

  it("serializes last-admin demotions at the database boundary", () => {
    expect(migration).toContain("pg_advisory_xact_lock(20260824, 1)");
    expect(migration).toContain("create trigger profiles_preserve_last_admin");
    expect(migration).toContain("message = 'admin_last_admin'");
  });
});
