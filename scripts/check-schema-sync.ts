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
 * Requires Node >= 22.6 (native TypeScript stripping). Run via `npm run schema:check`.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type ColumnCheck = { table: string; column: string };

const REQUIRED_TABLES: string[] = ["profiles", "models", "tasks", "model_responses", "votes"];

const REQUIRED_COLUMNS: ColumnCheck[] = [
  { table: "tasks", column: "task_text" },
  { table: "tasks", column: "mode_slug" },
  { table: "model_responses", column: "task_id" },
  { table: "votes", column: "task_id" },
  { table: "models", column: "model_key" },
  { table: "models", column: "provider" },
  { table: "models", column: "status" },
];

function getConnectionString(): string | null {
  // Never log these values.
  const value = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!value || value.trim() === "") return null;
  return value;
}

async function introspect(client: pg.Client): Promise<{
  tables: Set<string>;
  columns: Map<string, Set<string>>;
}> {
  const tablesResult = await client.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'`
  );
  const columnsResult = await client.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'`
  );

  const tables = new Set<string>();
  for (const row of tablesResult.rows) tables.add(row.table_name);

  const columns = new Map<string, Set<string>>();
  for (const row of columnsResult.rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Set<string>());
    columns.get(row.table_name)!.add(row.column_name);
  }

  return { tables, columns };
}

function report(tables: Set<string>, columns: Map<string, Set<string>>): number {
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
  if (missing === 0) {
    console.log("SCHEMA SYNC OK — all required tables and columns are present.");
    return 0;
  }
  console.log(`SCHEMA SYNC FAILED — ${missing} missing item(s).`);
  return 1;
}

async function main(): Promise<number> {
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
    const code = (error as { code?: string }).code ?? "CONNECTION_ERROR";
    console.error(`Could not connect to Supabase Postgres (${code}). Check SUPABASE_DB_URL.`);
    return 2;
  }

  try {
    const { tables, columns } = await introspect(client);
    return report(tables, columns);
  } catch (error) {
    const code = (error as { code?: string }).code ?? "QUERY_ERROR";
    console.error(`Schema introspection failed (${code}).`);
    return 2;
  } finally {
    await client.end().catch(() => {});
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    const code = (error as { code?: string }).code ?? "UNEXPECTED_ERROR";
    console.error(`Schema sync check could not run (${code}).`);
    process.exit(2);
  });
