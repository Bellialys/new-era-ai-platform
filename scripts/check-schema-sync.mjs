#!/usr/bin/env node
/**
 * Supabase Schema Sync Check
 *
 * Connects to the real Supabase PostgreSQL database and verifies that the
 * tables, columns, generated columns, RPC functions, and storage buckets the
 * project relies on actually exist.
 *
 * SECURITY:
 *   - reads SUPABASE_DB_URL (fallback DATABASE_URL) from .env.local
 *   - NEVER prints the connection string, host, user or password
 *   - on connection errors prints only a safe description, never the raw pg message
 *
 * Usage:
 *   node scripts/check-schema-sync.mjs [options]
 *
 * Options:
 *   --help, -h        Show this help and exit (0)
 *   --version, -v     Print version from package.json and exit (0)
 *   --json            Emit a JSON report to stdout (ideal for CI pipelines)
 *   --schema <name>   Database schema to inspect (default: public)
 *
 * Environment variables (read from .env.local):
 *   SUPABASE_DB_URL       Primary connection string (preferred)
 *   DATABASE_URL          Fallback connection string
 *   SCHEMA_CHECK_DEBUG=1  Print stack traces on unexpected errors
 *
 * Exit codes:
 *   0  all required schema objects are present (or --help / --version)
 *   1  one or more required items missing or invalid (schema drift)
 *   2  cannot run: env not configured, unknown flag, or database unreachable
 */

import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------
const EXIT_CODES = {
  SUCCESS:       0,
  SCHEMA_DRIFT:  1,
  RUNTIME_ERROR: 2,
};

// ---------------------------------------------------------------------------
// Required schema definitions
// ---------------------------------------------------------------------------
const REQUIRED_TABLES = [
  "profiles",
  "models",
  "tasks",
  "model_responses",
  "votes",
  "anonymous_sessions",
];

const REQUIRED_COLUMNS = [
  { table: "profiles",           column: "id" },
  { table: "profiles",           column: "email" },
  { table: "profiles",           column: "display_name" },
  { table: "profiles",           column: "first_name" },
  { table: "profiles",           column: "last_name" },
  { table: "profiles",           column: "avatar_url" },
  { table: "profiles",           column: "role" },
  { table: "profiles",           column: "plan" },
  { table: "profiles",           column: "created_at" },
  { table: "profiles",           column: "updated_at" },
  { table: "models",             column: "id" },
  { table: "models",          column: "model_key" },
  { table: "models",          column: "provider" },
  { table: "models",          column: "display_name" },
  { table: "models",          column: "description" },
  { table: "models",          column: "role_tags" },
  { table: "models",          column: "price_label" },
  { table: "models",          column: "is_active" },
  { table: "models",          column: "is_public" },
  { table: "models",          column: "sort_order" },
  { table: "models",          column: "raw_metadata" },
  { table: "models",          column: "access_level" },
  { table: "models",          column: "status" },
  { table: "tasks",           column: "id" },
  { table: "tasks",           column: "task_text" },
  { table: "tasks",           column: "mode_slug" },
  { table: "tasks",           column: "status" },
  { table: "tasks",           column: "selected_models" },
  { table: "tasks",           column: "settings" },
  { table: "tasks",           column: "user_id" },
  { table: "tasks",           column: "anonymous_session_id" },
  { table: "tasks",           column: "error_message" },
  { table: "model_responses", column: "id" },
  { table: "model_responses", column: "task_id" },
  { table: "model_responses", column: "model_id" },
  { table: "model_responses", column: "model_key" },
  { table: "model_responses", column: "display_name" },
  { table: "model_responses", column: "response_text" },
  { table: "model_responses", column: "status" },
  { table: "model_responses", column: "error_code" },
  { table: "model_responses", column: "error_message" },
  { table: "model_responses", column: "latency_ms" },
  { table: "model_responses", column: "input_tokens" },
  { table: "model_responses", column: "output_tokens" },
  { table: "model_responses", column: "total_tokens" },
  { table: "model_responses", column: "raw_response" },
  { table: "votes",           column: "id" },
  { table: "votes",           column: "task_id" },
  { table: "votes",           column: "model_response_id" },
  { table: "votes",           column: "anonymous_session_id" },
  { table: "votes",           column: "user_id" },
  { table: "votes",           column: "vote_type" },
  { table: "votes",           column: "reason" },
  { table: "votes",           column: "created_at" },
  { table: "votes",           column: "updated_at" },
  { table: "anonymous_sessions", column: "id" },
  { table: "anonymous_sessions", column: "display_name" },
  { table: "anonymous_sessions", column: "avatar_seed" },
  { table: "anonymous_sessions", column: "color_seed" },
  { table: "anonymous_sessions", column: "created_at" },
  { table: "anonymous_sessions", column: "last_seen_at" },
  { table: "anonymous_sessions", column: "converted_user_id" },
];

/**
 * Columns that must be ALWAYS-generated.
 * Every string in expressionIncludes must appear in the normalised expression.
 */
const REQUIRED_GENERATED_COLUMNS = [
  {
    table:              "models",
    column:             "status",
    expressionIncludes: ["is_active", "active", "inactive"],
  },
];

const REQUIRED_FUNCTIONS = [
  {
    name:             "cast_best_vote",
    argumentIncludes: ["p_task_id uuid", "p_response_id uuid", "p_user_id uuid", "p_anon_id text"],
  },
];

const REQUIRED_STORAGE_BUCKETS = [
  {
    id:               "avatars",
    public:           false,
    fileSizeLimit:    2_097_152,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const flags = { help: false, version: false, json: false, schema: "public", unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        flags.help = true;
        break;
      case "--version":
      case "-v":
        flags.version = true;
        break;
      case "--json":
        flags.json = true;
        break;
      case "--schema": {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) {
          flags.unknown.push(`${arg} (requires a value, e.g. --schema public)`);
        } else {
          flags.schema = next;
          i++;
        }
        break;
      }
      default:
        flags.unknown.push(arg);
    }
  }
  return flags;
}

function showHelp() {
  console.log(
    [
      "Usage: node scripts/check-schema-sync.mjs [options]",
      "",
      "Connects to the Supabase PostgreSQL database and verifies that all required",
      "tables, columns, generated columns, RPC functions, and storage buckets are present.",
      "",
      "Options:",
      "  --help, -h        Show this help and exit",
      "  --version, -v     Print version from package.json and exit",
      "  --json            Emit a JSON report to stdout (ideal for CI pipelines)",
      "  --schema <name>   Database schema to inspect (default: public)",
      "",
      "Environment variables (read from .env.local):",
      "  SUPABASE_DB_URL       Primary connection string (preferred)",
      "  DATABASE_URL          Fallback connection string",
      "  SCHEMA_CHECK_DEBUG=1  Print stack traces on unexpected errors",
      "",
      "Exit codes:",
      "  0  all required schema objects are present",
      "  1  one or more items are missing or invalid (schema drift)",
      "  2  cannot run: env not configured, unknown flag, or database unreachable",
    ].join("\n"),
  );
}

function showVersion() {
  const pkgPath = join(ROOT, "package.json");
  if (!existsSync(pkgPath)) {
    console.log("unknown (no package.json)");
    return;
  }
  try {
    const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
    console.log(version ?? "unknown");
  } catch {
    console.log("unknown");
  }
}

// ---------------------------------------------------------------------------
// Security helpers — credentials must never be exposed
// ---------------------------------------------------------------------------

/**
 * Returns a displayable version of a connection string with credentials masked.
 * Safe to include in SCHEMA_CHECK_DEBUG output.
 */
function maskConnectionString(connStr) {
  try {
    const url = new URL(connStr);
    if (url.username) url.username = "***";
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "***masked***";
  }
}

/**
 * Returns a human-readable, credential-free description for common pg errors.
 * Never exposes the raw error message, which may contain host or credentials.
 */
const CONN_ERROR_DESCRIPTIONS = new Map([
  ["ECONNREFUSED", "connection refused — Supabase project may be paused or inaccessible"],
  ["ETIMEDOUT",    "connection timed out — check network, firewall, or Supabase IP allow-list"],
  ["ENOTFOUND",    "hostname not found — verify the host in SUPABASE_DB_URL"],
  ["ECONNRESET",   "connection reset — transient network error, try again"],
  ["28P01",        "authentication failed — invalid database credentials"],
  ["3D000",        "database not found — check the database name in the connection string"],
  ["57P01",        "server terminated the connection — it may be restarting"],
]);

function classifyConnectionError(err) {
  const code = err?.code ?? "";
  return CONN_ERROR_DESCRIPTIONS.get(code) ?? `unexpected error (${code || "unknown"})`;
}

function getConnectionString() {
  const value = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!value || value.trim() === "") return null;
  return value;
}

// ---------------------------------------------------------------------------
// Database utilities
// ---------------------------------------------------------------------------

/** PostgreSQL error codes that indicate a transient server interruption. */
const TRANSIENT_PG_CODES = new Set(["57P01", "57P02", "57P03", "08006", "08001"]);

/**
 * Executes a pg query with exponential-backoff retry on transient errors.
 * @param {import("pg").Client} client
 * @param {string | { text: string; values: unknown[] }} query
 * @param {number} [maxAttempts]
 */
async function queryWithRetry(client, query, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.query(query);
    } catch (err) {
      if (!TRANSIENT_PG_CODES.has(err.code) || attempt === maxAttempts) throw err;
      const delay = Math.min(100 * 2 ** attempt, 3000);
      console.error(
        `check-schema-sync: query attempt ${attempt} failed (${err.code}), retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---------------------------------------------------------------------------
// Schema introspection — parameterised queries prevent SQL injection
// ---------------------------------------------------------------------------

/**
 * @typedef {{ isGenerated: string; generationExpression: string | null }} ColumnInfo
 * @typedef {{ name: string; arguments: string[] }} FunctionInfo
 * @typedef {{ public: boolean; fileSizeLimit: number | null; allowedMimeTypes: string[] | null }} StorageBucketInfo
 *
 * @param {import("pg").Client} client
 * @param {string} schemaName
 * @returns {Promise<{
 *   tables: Set<string>;
 *   columns: Map<string, Map<string, ColumnInfo>>;
 *   functions: Map<string, string[]>;
 *   storageBuckets: Map<string, StorageBucketInfo>;
 *   storageError: string | null;
 * }>}
 */
async function introspect(client, schemaName) {
  const tablesResult = await queryWithRetry(client, {
    text: `SELECT table_name
             FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type   = 'BASE TABLE'`,
    values: [schemaName],
  });

  const columnsResult = await queryWithRetry(client, {
    text: `SELECT table_name, column_name, is_generated, generation_expression
             FROM information_schema.columns
            WHERE table_schema = $1`,
    values: [schemaName],
  });

  const functionsResult = await queryWithRetry(client, {
    text: `SELECT p.proname AS function_name,
                  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
             FROM pg_catalog.pg_proc p
             JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = $1
              AND p.proname = ANY($2::text[])`,
    values: [schemaName, REQUIRED_FUNCTIONS.map(({ name }) => name)],
  });

  const tables = new Set();
  for (const row of tablesResult.rows) {
    tables.add(row.table_name);
  }

  // table -> column -> { isGenerated, generationExpression }
  const columns = new Map();
  for (const row of columnsResult.rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Map());
    columns.get(row.table_name).set(row.column_name, {
      isGenerated:          row.is_generated,
      generationExpression: row.generation_expression ?? null,
    });
  }

  const functions = new Map();
  for (const row of functionsResult.rows) {
    if (!functions.has(row.function_name)) functions.set(row.function_name, []);
    functions.get(row.function_name).push(row.arguments ?? "");
  }

  const { storageBuckets, storageError } = await introspectStorageBuckets(client);

  return { tables, columns, functions, storageBuckets, storageError };
}

/**
 * Storage bucket metadata is outside the public schema, but avatar upload
 * depends on it just as strongly as the public tables.
 *
 * @param {import("pg").Client} client
 * @returns {Promise<{ storageBuckets: Map<string, StorageBucketInfo>; storageError: string | null }>}
 */
async function introspectStorageBuckets(client) {
  const ids = REQUIRED_STORAGE_BUCKETS.map(({ id }) => id);
  if (ids.length === 0) return { storageBuckets: new Map(), storageError: null };

  try {
    const bucketsResult = await queryWithRetry(client, {
      text: `SELECT id,
                    public AS is_public,
                    file_size_limit,
                    allowed_mime_types
               FROM storage.buckets
              WHERE id = ANY($1::text[])`,
      values: [ids],
    });

    const storageBuckets = new Map();
    for (const row of bucketsResult.rows) {
      storageBuckets.set(row.id, {
        public:           row.is_public,
        fileSizeLimit:    row.file_size_limit === null ? null : Number(row.file_size_limit),
        allowedMimeTypes: row.allowed_mime_types ?? null,
      });
    }

    return { storageBuckets, storageError: null };
  } catch (err) {
    if (err?.code === "42P01" || err?.code === "3F000") {
      return { storageBuckets: new Map(), storageError: err.code };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Strips SQL comments, lowercases, and collapses whitespace so that
 * generated-column expression matching is reliable across formatting styles.
 * @param {string} expr
 */
function normalizeExpression(expr) {
  return expr
    .replace(/--[^\n]*/g, "")         // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSqlFragment(value) {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function sortedUniqueStrings(values) {
  return [...new Set((values ?? []).map(String))].sort();
}

/**
 * Validates the introspected schema against the project requirements.
 * Returns structured error objects; an empty array means the schema is in sync.
 */
function validateSchema({ tables, columns, functions, storageBuckets, storageError }) {
  const errors = [];

  for (const table of REQUIRED_TABLES) {
    if (!tables.has(table)) {
      errors.push({ type: "TABLE_MISSING", table });
    }
  }

  for (const { table, column } of REQUIRED_COLUMNS) {
    if (!tables.has(table)) continue; // TABLE_MISSING already recorded
    if (!columns.get(table)?.has(column)) {
      errors.push({ type: "COLUMN_MISSING", table, column });
    }
  }

  for (const { table, column, expressionIncludes } of REQUIRED_GENERATED_COLUMNS) {
    if (!tables.has(table)) continue; // TABLE_MISSING already recorded
    const cols = columns.get(table);
    if (!cols?.has(column)) {
      errors.push({ type: "GENERATED_COLUMN_MISSING", table, column });
      continue;
    }
    const info = cols.get(column);
    if (info.isGenerated !== "ALWAYS") {
      errors.push({ type: "NOT_GENERATED", table, column, expressionIncludes });
      continue;
    }
    const normalized = normalizeExpression(info.generationExpression ?? "");
    const missing    = expressionIncludes.filter((t) => !normalized.includes(t.toLowerCase()));
    if (missing.length > 0) {
      errors.push({ type: "GENERATED_EXPR_MISMATCH", table, column, expressionIncludes, missing });
    }
  }

  for (const { name, argumentIncludes } of REQUIRED_FUNCTIONS) {
    const overloads = functions.get(name) ?? [];
    if (overloads.length === 0) {
      errors.push({ type: "FUNCTION_MISSING", functionName: name });
      continue;
    }

    const normalizedOverloads = overloads.map(normalizeSqlFragment);
    const hasRequiredSignature = normalizedOverloads.some((args) =>
      argumentIncludes.every((fragment) => args.includes(normalizeSqlFragment(fragment))),
    );

    if (!hasRequiredSignature) {
      errors.push({
        type: "FUNCTION_ARGUMENT_MISMATCH",
        functionName: name,
        argumentIncludes,
        found: overloads,
      });
    }
  }

  if (storageError) {
    errors.push({ type: "STORAGE_METADATA_UNAVAILABLE", code: storageError });
  }

  for (const { id, public: expectedPublic, fileSizeLimit, allowedMimeTypes } of REQUIRED_STORAGE_BUCKETS) {
    if (storageError) continue;

    const bucket = storageBuckets.get(id);
    if (!bucket) {
      errors.push({ type: "STORAGE_BUCKET_MISSING", bucket: id });
      continue;
    }

    if (bucket.public !== expectedPublic) {
      errors.push({
        type: "STORAGE_BUCKET_PUBLIC_MISMATCH",
        bucket: id,
        expected: expectedPublic,
        actual: bucket.public,
      });
    }

    if (bucket.fileSizeLimit !== fileSizeLimit) {
      errors.push({
        type: "STORAGE_BUCKET_FILE_SIZE_MISMATCH",
        bucket: id,
        expected: fileSizeLimit,
        actual: bucket.fileSizeLimit,
      });
    }

    const actualMimeTypes = sortedUniqueStrings(bucket.allowedMimeTypes);
    const expectedMimeTypes = sortedUniqueStrings(allowedMimeTypes);
    if (actualMimeTypes.join("\n") !== expectedMimeTypes.join("\n")) {
      errors.push({
        type: "STORAGE_BUCKET_MIME_TYPES_MISMATCH",
        bucket: id,
        expected: expectedMimeTypes,
        actual: actualMimeTypes,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Report output
// ---------------------------------------------------------------------------

function describeError(err) {
  switch (err.type) {
    case "TABLE_MISSING":
      return `Missing table: "${err.table}"`;
    case "COLUMN_MISSING":
      return `Missing column: "${err.table}"."${err.column}"`;
    case "GENERATED_COLUMN_MISSING":
      return `Missing generated column: "${err.table}"."${err.column}"`;
    case "NOT_GENERATED":
      return `Column "${err.table}"."${err.column}" must be ALWAYS-generated`;
    case "GENERATED_EXPR_MISMATCH":
      return (
        `Generated column "${err.table}"."${err.column}": expression must include ` +
        err.expressionIncludes.map((t) => `"${t}"`).join(", ")
      );
    case "FUNCTION_MISSING":
      return `Missing function: "${err.functionName}"`;
    case "FUNCTION_ARGUMENT_MISMATCH":
      return (
        `Function "${err.functionName}": signature must include ` +
        err.argumentIncludes.map((t) => `"${t}"`).join(", ")
      );
    case "STORAGE_METADATA_UNAVAILABLE":
      return `Storage metadata unavailable: storage.buckets cannot be inspected (${err.code})`;
    case "STORAGE_BUCKET_MISSING":
      return `Missing storage bucket: "${err.bucket}"`;
    case "STORAGE_BUCKET_PUBLIC_MISMATCH":
      return `Storage bucket "${err.bucket}": public must be ${err.expected}, got ${err.actual}`;
    case "STORAGE_BUCKET_FILE_SIZE_MISMATCH":
      return (
        `Storage bucket "${err.bucket}": file_size_limit must be ${err.expected}, ` +
        `got ${err.actual}`
      );
    case "STORAGE_BUCKET_MIME_TYPES_MISMATCH":
      return (
        `Storage bucket "${err.bucket}": allowed_mime_types must be ` +
        err.expected.map((t) => `"${t}"`).join(", ")
      );
    default:
      return JSON.stringify(err);
  }
}

function printReport(errors, { asJson, schemaName }) {
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          schema:    schemaName,
          status:    errors.length === 0 ? "sync" : "drift",
          errors:    errors.map((e) => ({ ...e, message: describeError(e) })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Supabase schema sync check (schema: ${schemaName})`);
  console.log("");

  if (errors.length === 0) {
    console.log("SCHEMA SYNC OK — all required schema objects are present.");
    return;
  }

  console.log(`SCHEMA SYNC FAILED — ${errors.length} issue(s):`);
  console.log("");
  for (const err of errors) {
    console.log(`  FAIL  ${describeError(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let activeClient = null;

async function shutdown(signal) {
  console.error(`\ncheck-schema-sync: received ${signal}, closing database connection`);
  if (activeClient) await activeClient.end().catch(() => {});
  process.exit(EXIT_CODES.RUNTIME_ERROR);
}
process.once("SIGINT",  () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    showHelp();
    return EXIT_CODES.SUCCESS;
  }
  if (flags.version) {
    showVersion();
    return EXIT_CODES.SUCCESS;
  }
  if (flags.unknown.length > 0) {
    console.error(
      `check-schema-sync: unknown argument(s): ${flags.unknown.join(", ")}. Run with --help.`,
    );
    return EXIT_CODES.RUNTIME_ERROR;
  }

  // Determine environment context BEFORE loading .env files so that platform
  // variables (VERCEL, NODE_ENV) are read from the real process environment.
  const isVercel     = !!(process.env.VERCEL || process.env.VERCEL_ENV);
  const isProduction = process.env.NODE_ENV === "production" || isVercel;
  const isDev        = !isProduction;
  const SILENT       = { info: () => {}, error: () => {}, warn: () => {} };

  loadEnvConfig(ROOT, isDev, SILENT);

  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error(
      "check-schema-sync: SUPABASE_DB_URL is not set. Add it to .env.local.\n" +
      "  Example: SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres\n" +
      "  Never commit the real connection string. See docs/35-database-schema-sync.md.",
    );
    return EXIT_CODES.RUNTIME_ERROR;
  }

  if (process.env.SCHEMA_CHECK_DEBUG) {
    console.error(`check-schema-sync: connecting to ${maskConnectionString(connectionString)}`);
  }

  const client = new Client({
    connectionString,
    ssl:                     { rejectUnauthorized: !isDev },
    connectionTimeoutMillis: 10_000,
    statement_timeout:       60_000,
  });
  activeClient = client;

  try {
    await client.connect();
  } catch (err) {
    const description = classifyConnectionError(err);
    console.error(`check-schema-sync: cannot connect — ${description}`);
    if (process.env.SCHEMA_CHECK_DEBUG) console.error(err.stack);
    return EXIT_CODES.RUNTIME_ERROR;
  }

  try {
    const dbData = await introspect(client, flags.schema);
    const errors = validateSchema(dbData);
    printReport(errors, { asJson: flags.json, schemaName: flags.schema });
    return errors.length === 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.SCHEMA_DRIFT;
  } catch (err) {
    const code = err?.code ?? "QUERY_ERROR";
    console.error(`check-schema-sync: introspection failed (${code})`);
    if (process.env.SCHEMA_CHECK_DEBUG) console.error(err.stack);
    return EXIT_CODES.RUNTIME_ERROR;
  } finally {
    activeClient = null;
    await client.end().catch(() => {});
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err?.code ?? "UNEXPECTED_ERROR";
    console.error(`check-schema-sync: unexpected failure (${code})`);
    if (process.env.SCHEMA_CHECK_DEBUG) console.error(err.stack);
    process.exit(EXIT_CODES.RUNTIME_ERROR);
  });
