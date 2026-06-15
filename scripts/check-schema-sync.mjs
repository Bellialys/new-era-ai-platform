/**
 * Supabase Schema Sync Check.
 *
 * Connects to the real Supabase PostgreSQL database and verifies that the
 * tables and columns the project documentation relies on actually exist.
 *
 * SECURITY:
 *   - reads SUPABASE_DB_URL (fallback DATABASE_URL) from .env.local;
 *   - NEVER prints the connection string, host, user or password;
 *   - on connection errors prints only a safe error code, not the raw message.
 *
 * Exit codes:
 *   0  every required table and column was found
 *   1  one or more required tables/columns are missing (schema drift)
 *   2  cannot run (no connection string, or the database is unreachable)
 *
 * Run via `npm run schema:check`.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(dirname(__dirname), ".");

const REQUIRED_TABLES = ["profiles", "models", "tasks", "model_responses", "votes"];

const REQUIRED_COLUMNS = [
  { table: "models", column: "model_key" },
  { table: "models", column: "provider" },
  { table: "models", column: "is_active" },
  { table: "models", column: "status" },
  { table: "tasks", column: "task_text" },
  { table: "tasks", column: "mode_slug" },
  { table: "tasks", column: "user_id" },
  { table: "tasks", column: "anonymous_session_id" },
  { table: "model_responses", column: "task_id" },
  { table: "votes", column: "task_id" },
  { table: "votes", column: "anonymous_session_id" },
  { table: "votes", column: "user_id" },
];

const REQUIRED_GENERATED_COLUMNS = [
  {
    table: "models",
    column: "status",
    expressionIncludes: ["is_active", "active", "inactive"],
  },
];

function getConnectionString() {
  // Never log these values.
  const value = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!value || value.trim() === "") return null;
  return value;
}

async function introspect(client) {
  const tablesResult = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'`
  );
  const columnsResult = await client.query(
    `select table_name, column_name, is_generated, generation_expression
       from information_schema.columns
      where table_schema = 'public'`
  );

  const tables = new Set();
  for (const row of tablesResult.rows) tables.add(row.table_name);

  const columns = new Map();
  for (const row of columnsResult.rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
    columns.get(row.table_name).set(row.column_name, {
      isGenerated: row.is_generated,
      generationExpression: row.generation_expression,
    });
  }

  return { tables, columns };
}

function report(tables, columns) {
  let missing = 0;

  console.log("Supabase schema sync check (schema: public)");
  console.log("");
  console.log("Tables:");
  for (const table of REQUIRED_TABLES) {
    if (tables.has(table)) {
      console.log(`  OK       ${table}`);
    } else {
      console.log(`  MISSING  ${table}`);
      missing += 1;
    }
  }

  console.log("");
  console.log("Columns:");
  for (const { table, column } of REQUIRED_COLUMNS) {
    const tableColumns = columns.get(table);
    if (!tables.has(table)) {
      console.log(`  MISSING  ${table}.${column} (table ${table} not found)`);
      missing += 1;
    } else if (tableColumns && tableColumns.has(column)) {
      console.log(`  OK       ${table}.${column}`);
    } else {
      console.log(`  MISSING  ${table}.${column}`);
      missing += 1;
    }
  }

  console.log("");
  console.log("Generated columns:");
  for (const { table, column, expressionIncludes } of REQUIRED_GENERATED_COLUMNS) {
    const columnInfo = columns.get(table)?.get(column);
    const expression = String(columnInfo?.generationExpression ?? "").toLowerCase();
    const hasExpectedExpression = expressionIncludes.every((part) => expression.includes(part.toLowerCase()));

    if (!tables.has(table)) {
      console.log(`  MISSING  ${table}.${column} (table ${table} not found)`);
      missing += 1;
    } else if (!columnInfo) {
      console.log(`  MISSING  ${table}.${column}`);
      missing += 1;
    } else if (columnInfo.isGenerated === "ALWAYS" && hasExpectedExpression) {
      console.log(`  OK       ${table}.${column} generated from is_active`);
    } else {
      console.log(`  INVALID  ${table}.${column} must be generated from is_active`);
      missing += 1;
    }
  }

  return missing;
}

// --- Vote RPC privilege checks -------------------------------------------

const VOTE_RPC_SIGNATURE = "public.cast_best_vote(uuid, uuid, uuid, text)";
const VOTE_RPC_ROLES = ["anon", "authenticated", "service_role"];

async function introspectVoteRpc(client) {
  // Locate the function by schema + name + argument type signature.
  const fn = await client.query(
    `select p.prosecdef
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'cast_best_vote'
        and pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, uuid, text'`
  );

  if (fn.rows.length === 0) {
    return { exists: false };
  }

  // has_*_privilege throws on a missing role, so only probe roles that exist.
  const rolesResult = await client.query(
    `select rolname from pg_roles where rolname = any($1)`,
    [VOTE_RPC_ROLES]
  );
  const roles = new Set(rolesResult.rows.map((row) => row.rolname));

  async function fnExecute(role) {
    if (!roles.has(role)) return null;
    const result = await client.query(
      `select has_function_privilege($1, $2, 'EXECUTE') as ok`,
      [role, VOTE_RPC_SIGNATURE]
    );
    return result.rows[0].ok === true;
  }

  async function votesPrivilege(role, privilege) {
    if (!roles.has(role)) return null;
    const result = await client.query(
      `select has_table_privilege($1, 'public.votes', $2) as ok`,
      [role, privilege]
    );
    return result.rows[0].ok === true;
  }

  return {
    exists: true,
    securityDefiner: fn.rows[0].prosecdef === true,
    execute: {
      anon: await fnExecute("anon"),
      authenticated: await fnExecute("authenticated"),
      service_role: await fnExecute("service_role"),
    },
    votes: {
      select: await votesPrivilege("service_role", "SELECT"),
      insert: await votesPrivilege("service_role", "INSERT"),
      delete: await votesPrivilege("service_role", "DELETE"),
    },
  };
}

function reportVoteRpc(rpc) {
  let problems = 0;

  console.log("");
  console.log("Vote RPC (public.cast_best_vote):");

  if (!rpc.exists) {
    console.log(`  MISSING  ${VOTE_RPC_SIGNATURE}`);
    return 1;
  }
  console.log("  OK       function exists");

  // We assert the security *property* (who may execute / which grants exist),
  // not a specific mode — cast_best_vote is intentionally service-role-only.
  const expect = (label, value, expected) => {
    if (value === null) {
      console.log(`  SKIP     ${label} (role not present)`);
      return;
    }
    if (value === expected) {
      console.log(`  OK       ${label}`);
    } else {
      console.log(`  INVALID  ${label} (expected ${expected ? "granted" : "revoked"})`);
      problems += 1;
    }
  };

  expect("execute revoked from anon", rpc.execute.anon, false);
  expect("execute revoked from authenticated", rpc.execute.authenticated, false);
  expect("execute granted to service_role", rpc.execute.service_role, true);
  expect("votes select granted to service_role", rpc.votes.select, true);
  expect("votes insert granted to service_role", rpc.votes.insert, true);
  expect("votes delete granted to service_role", rpc.votes.delete, true);

  console.log(`  INFO     security mode: ${rpc.securityDefiner ? "definer" : "invoker"}`);

  return problems > 0 ? 1 : 0;
}

async function main() {
  loadEnvConfig(ROOT, true, { info: () => {}, error: () => {} });

  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error(
      "SUPABASE_DB_URL is not set. Add it to .env.local (e.g. SUPABASE_DB_URL=postgresql://...)."
    );
    console.error("Never commit the real connection string. See 35-database-schema-sync.md.");
    return 2;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (error) {
    // Print only a safe error code — never the connection string or raw message.
    const code = error?.code ?? "CONNECTION_ERROR";
    console.error(`Could not connect to Supabase Postgres (${code}). Check SUPABASE_DB_URL.`);
    return 2;
  }

  try {
    const { tables, columns } = await introspect(client);
    const missing = report(tables, columns);
    const rpcProblems = reportVoteRpc(await introspectVoteRpc(client));

    const total = missing + rpcProblems;
    console.log("");
    if (total === 0) {
      console.log("SCHEMA SYNC OK — tables, columns and vote RPC privileges verified.");
      return 0;
    }
    console.log(`SCHEMA SYNC FAILED — ${total} problem(s).`);
    return 1;
  } catch (error) {
    const code = error?.code ?? "QUERY_ERROR";
    console.error(`Schema introspection failed (${code}).`);
    return 2;
  } finally {
    await client.end().catch(() => {});
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    const code = error?.code ?? "UNEXPECTED_ERROR";
    console.error(`Schema sync check could not run (${code}).`);
    process.exit(2);
  });
