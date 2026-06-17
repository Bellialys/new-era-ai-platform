#!/usr/bin/env node
/**
 * Environment Variables Checker for New Era AI Platform.
 *
 * SECURITY CONTRACT (see docs/37-env-check-policy.md):
 *   - never prints a variable value, not even partially;
 *   - never prints the length of a value;
 *   - never prints a JWT payload or claims;
 *   - never does console.log(process.env) or JSON.stringify(process.env);
 *   - never writes secrets to reports or temp files.
 * Output is limited to variable NAMES and statuses, which is safe to share.
 *
 * Usage:
 *   node scripts/check-env.mjs [--mode=basic|migrations|full] [--json] [--ci] [--strict]
 *   node scripts/check-env.mjs --generate-example
 *   node scripts/check-env.mjs --help | --version
 *
 * Environment variables:
 *   ENV_CHECK_DIR       Override base directory for .env / .gitignore lookup
 *   ENV_CHECK_DEBUG=1   Print stack traces on unexpected errors
 *
 * Exit codes:
 *   0  success
 *   1  missing / empty / invalid required variables (or warnings in --strict mode)
 *   2  bad invocation or unexpected script error
 *   3  security risk (potential secret leak, or .env.local not gitignored)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SCRIPT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// BASE_DIR: where .env.local / .gitignore live.
// Overridable via ENV_CHECK_DIR for tests; defaults to the project root.
const BASE_DIR = process.env.ENV_CHECK_DIR || SCRIPT_ROOT;
const CONFIG_PATH = join(SCRIPT_ROOT, "env-check.config.json");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EXIT_CODES = {
  SUCCESS:          0,
  VALIDATION_ERROR: 1,
  INVOCATION_ERROR: 2,
  SECURITY_ERROR:   3,
};

const VALID_MODES = new Set(["basic", "migrations", "full"]);

// Words that must never appear in a NEXT_PUBLIC_* (client-exposed) variable name.
const DANGEROUS_WORDS = [
  "SECRET", "TOKEN", "PASSWORD", "DATABASE",
  "SERVICE_ROLE", "PRIVATE", "OPENROUTER", "API_KEY",
];

const STATUS = {
  OK:       "ok",
  MISSING:  "missing",
  EMPTY:    "empty",
  INVALID:  "invalid",
  OPTIONAL: "optional",
  WARNING:  "warning",
  FATAL:    "fatal",
};

// Accept common truthy values for CI — "true", "1", "yes" are all valid.
const CI_TRUTHY = new Set(["true", "1", "yes"]);

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
/**
 * @param {string[]} argv
 * @returns {{ mode: string, json: boolean, ci: boolean, strict: boolean,
 *             generateExample: boolean, help: boolean, version: boolean,
 *             unknown: string[] }}
 */
function parseArgs(argv) {
  const flags = {
    mode: "basic", json: false, ci: false, strict: false,
    generateExample: false, help: false, version: false, unknown: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":                 flags.help    = true; break;
      case "--version":
      case "-v":                 flags.version = true; break;
      case "--json":             flags.json    = true; break;
      case "--ci":               flags.ci      = true; break;
      case "--strict":           flags.strict  = true; break;
      case "--generate-example": flags.generateExample = true; break;
      default:
        if (arg.startsWith("--mode=")) {
          flags.mode = arg.slice("--mode=".length);
        } else if (arg === "--mode" && i + 1 < argv.length) {
          flags.mode = argv[++i];
        } else {
          flags.unknown.push(arg);
        }
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Help & version
// ---------------------------------------------------------------------------
function showHelp() {
  console.log(`
Usage: node scripts/check-env.mjs [options]

Options:
  --mode=<mode>       Check mode: basic | migrations | full  (default: basic)
  --mode <mode>       Alternative mode syntax
  --json              Output results as JSON
  --ci                Emit GitHub Actions ::error:: / ::warning:: annotations
  --strict            Treat required-variable warnings as errors (exit 1)
  --generate-example  Generate .env.local.example from config (never reads values)
  --help, -h          Show this help
  --version, -v       Show version from package.json

Environment variables:
  ENV_CHECK_DIR       Override base directory for .env / .gitignore lookup
  ENV_CHECK_DEBUG=1   Print stack traces on unexpected errors

Exit codes:
  0  all required variables present and valid
  1  missing / empty / invalid required variables (or required warnings in --strict)
  2  bad invocation or unexpected error
  3  security risk (secret leak or .env.local not gitignored)
`);
}

function showVersion() {
  const pkgPath = join(SCRIPT_ROOT, "package.json");
  if (existsSync(pkgPath)) {
    try {
      console.log(JSON.parse(readFileSync(pkgPath, "utf8")).version || "unknown");
    } catch {
      console.log("unknown");
    }
  } else {
    console.log("unknown (no package.json)");
  }
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Configuration file not found: ${CONFIG_PATH}`);
  }
  let config;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch (err) {
    throw new Error(`Invalid JSON in env-check.config.json: ${err.message}`);
  }
  if (!config || !Array.isArray(config.variables)) {
    throw new Error("env-check.config.json is missing a 'variables' array");
  }
  for (let i = 0; i < config.variables.length; i++) {
    const v = config.variables[i];
    if (!v || typeof v.name !== "string") {
      throw new Error(`Variable at index ${i} is missing a valid 'name'`);
    }
    // Default to "full" so variables without explicit groups are not silently skipped.
    if (!Array.isArray(v.groups)) {
      config.variables[i] = { ...v, groups: ["full"] };
    }
  }
  return config;
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------
/** Resolve a variable's value via primary name or aliases. Never logs the value. */
function resolveValue(variable) {
  const names = [variable.name, ...(variable.aliases || [])];
  for (const name of names) {
    if (process.env[name] !== undefined) return process.env[name];
  }
  return undefined;
}

/**
 * Decode a JWT payload without logging it.
 * Requires Node >=20.9.0 (native base64url — matches project engines field).
 */
function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null; // JWT is always header.payload.signature
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
/**
 * @param {object} variable
 * @param {string} value
 * @returns {{ ok: boolean, warn?: boolean, message: string }}
 */
function validateValue(variable, value) {
  const rule = variable.validation || { type: "nonEmptyString" };

  switch (rule.type) {
    case "nonEmptyString":
      return { ok: true, message: "exists" };

    case "regex": {
      let pattern;
      try {
        pattern = new RegExp(rule.pattern);
      } catch {
        return { ok: false, message: `invalid regex pattern in config: ${rule.pattern}` };
      }
      return pattern.test(value)
        ? { ok: true, message: "exists" }
        : { ok: false, message: rule.message || "failed regex validation" };
    }

    case "supabaseServiceRoleJwt": {
      // New-style Supabase secret keys are not JWTs; accept them as-is.
      if (value.startsWith("sb_secret_")) return { ok: true, message: "exists" };
      if (!value.startsWith("eyJ")) return { ok: false, message: "must be a valid JWT-like value" };
      const payload = decodeJwtPayload(value);
      if (!payload) return { ok: false, message: "must be a valid JWT-like value" };
      if (!payload.role) return { ok: true, warn: true, message: "JWT payload missing 'role' claim" };
      if (payload.role === "anon") return { ok: false, message: "must be service_role, not anon" };
      if (payload.role !== "service_role") {
        return { ok: true, warn: true, message: "JWT role claim is not 'service_role'" };
      }
      return { ok: true, message: "exists" };
    }

    default:
      // Unknown validation type: pass through without blocking.
      return { ok: true, message: "exists" };
  }
}

/** Build a per-variable result without ever echoing the value in output. */
function checkVariable(variable) {
  const base = {
    name:     variable.name,
    required: !!variable.required,
    category: variable.category || "general",
  };
  const value = resolveValue(variable);

  if (value === undefined) {
    return variable.required
      ? { ...base, status: STATUS.MISSING,  message: "is required" }
      : { ...base, status: STATUS.OPTIONAL, message: "is not set (optional)" };
  }
  if (value.trim() === "") {
    return variable.required
      ? { ...base, status: STATUS.EMPTY,    message: "is required but empty" }
      : { ...base, status: STATUS.OPTIONAL, message: "is not set (optional)" };
  }

  const result = validateValue(variable, value);
  if (!result.ok) {
    return variable.required
      ? { ...base, status: STATUS.INVALID, message: result.message }
      : { ...base, status: STATUS.WARNING, message: result.message };
  }
  if (result.warn) return { ...base, status: STATUS.WARNING, message: result.message };
  return { ...base, status: STATUS.OK, message: "exists" };
}

// ---------------------------------------------------------------------------
// Security checks
// ---------------------------------------------------------------------------
/** Scan NEXT_PUBLIC_* variable names for dangerous words. Returns FATAL entries. */
function detectLeaks() {
  const fatals = [];
  for (const name of Object.keys(process.env)) {
    if (!name.startsWith("NEXT_PUBLIC_")) continue;
    const upper = name.toUpperCase();
    if (DANGEROUS_WORDS.some((word) => upper.includes(word))) {
      fatals.push({
        name,
        status:   STATUS.FATAL,
        required: false,
        category: "security",
        message:  `Potential secret exposed to client: ${name} must not be public`,
      });
    }
  }
  return fatals;
}

/** Verify .env.local is covered by an ignore-file pattern. */
function ignoreFileCoversEnvLocal(path) {
  if (!existsSync(path)) return false;
  const lines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  return lines.some(
    (l) =>
      l === ".env.local"  ||
      l === ".env*.local" ||
      l === ".env*"       ||
      l === ".env"        ||
      l === ".env.*"      ||
      (l.startsWith(".env") && l.includes(".local") && l.includes("*"))
  );
}

/** Verify .env.local is protected from local Git and Vercel uploads. */
function isEnvLocalIgnored({ allowVercelignore = false } = {}) {
  if (ignoreFileCoversEnvLocal(join(BASE_DIR, ".gitignore"))) return true;
  return allowVercelignore && ignoreFileCoversEnvLocal(join(BASE_DIR, ".vercelignore"));
}

/** Detect duplicate variable names in .env.local. Returns names only — never values. */
function findDuplicateKeys() {
  const envLocalPath = join(BASE_DIR, ".env.local");
  if (!existsSync(envLocalPath)) return [];
  const counts = new Map();
  for (const rawLine of readFileSync(envLocalPath, "utf8").split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    // Support both `KEY=val` and `export KEY=val` (e.g. bash-sourced .env files).
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) continue;
    const key = match[1];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key);
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------
function formatLine(detail) {
  const label = detail.status.toUpperCase().padEnd(8);
  return `${label} ${detail.name}: ${detail.message}`;
}

/** Emit GitHub Actions / GitLab CI annotations. */
function emitCi(detail) {
  const line = formatLine(detail);
  if ([STATUS.MISSING, STATUS.EMPTY, STATUS.INVALID, STATUS.FATAL].includes(detail.status)) {
    console.log(`::error::${line}`);
  } else if (detail.status === STATUS.WARNING) {
    console.log(`::warning::${line}`);
  }
}

// ---------------------------------------------------------------------------
// Example generator
// ---------------------------------------------------------------------------
function generateExample(config) {
  const lines = [
    "# .env.local.example — generated by `npm run env:check:example`.",
    "# Primary local template for .env.local.",
    "# Placeholder values only. Never put real secrets here.",
    "# Copy to .env.local and replace placeholders with real values locally.",
    "",
  ];
  // Group by category, preserving config declaration order.
  const byCategory = new Map();
  for (const v of config.variables) {
    const cat = v.category || "general";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(v);
  }
  for (const [category, vars] of byCategory) {
    lines.push(`# ${category} variables`);
    for (const v of vars) lines.push(`${v.name}=${v.example ?? ""}`);
    lines.push("");
  }
  if (lines[lines.length - 1] === "") lines.pop();
  const outPath = join(BASE_DIR, ".env.local.example");
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  return outPath;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------
function run() {
  const flags = parseArgs(process.argv.slice(2));

  // --help / --version: respond without loading config or .env files.
  if (flags.help) {
    showHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }
  if (flags.version) {
    showVersion();
    process.exit(EXIT_CODES.SUCCESS);
  }

  // Unknown arguments.
  if (flags.unknown.length > 0) {
    console.error(`check-env: unknown argument(s): ${flags.unknown.join(", ")}. Run with --help.`);
    return EXIT_CODES.INVOCATION_ERROR;
  }
  if (!VALID_MODES.has(flags.mode)) {
    console.error(`check-env: invalid --mode "${flags.mode}". Use one of: ${[...VALID_MODES].join(", ")}.`);
    return EXIT_CODES.INVOCATION_ERROR;
  }

  const config = loadConfig();

  // --generate-example never reads process.env values.
  if (flags.generateExample) {
    const examplePath = generateExample(config);
    console.log(`Generated ${examplePath} (${config.variables.length} variables, placeholders only).`);
    return EXIT_CODES.SUCCESS;
  }

  // Determine environment context BEFORE loading .env files so that platform
  // variables (VERCEL, NODE_ENV) are read from the real environment, not from
  // a .env file that loadEnvConfig might inject into process.env.
  const isVercel     = !!(process.env.VERCEL || process.env.VERCEL_ENV);
  const isProduction = process.env.NODE_ENV === "production" || isVercel;
  const isDev        = !isProduction;

  const envLocalExisted = existsSync(join(BASE_DIR, ".env.local"));
  // Load .env files the same way Next.js does (silent logger — no value output).
  loadEnvConfig(BASE_DIR, isDev, { info: () => {}, error: () => {}, warn: () => {} });

  // CI mode: accept common truthy values, not just "true".
  const isCi = flags.ci || CI_TRUTHY.has((process.env.CI ?? "").toLowerCase());

  const details = [];

  // 1. Security checks first — FATAL causes exit 3.
  details.push(...detectLeaks());
  if (!isEnvLocalIgnored({ allowVercelignore: isVercel })) {
    details.push({
      name:     ".env.local",
      status:   STATUS.FATAL,
      required: false,
      category: "security",
      message:  isVercel
        ? ".env.local must be ignored by Git or Vercel deployment ignore"
        : ".env.local must be ignored by Git",
    });
  }

  // 2. Variables for the selected mode.
  const inMode = config.variables.filter((v) => v.groups.includes(flags.mode));
  for (const variable of inMode) details.push(checkVariable(variable));

  // 3. Non-blocking warnings.
  if (!envLocalExisted && !isCi && !isProduction) {
    details.push({
      name: ".env.local", status: STATUS.WARNING, required: false, category: "local",
      message: ".env.local file not found",
    });
  }
  for (const key of findDuplicateKeys()) {
    details.push({
      name: key, status: STATUS.WARNING, required: false, category: "local",
      message: `${key} defined multiple times in .env.local`,
    });
  }

  // 4. Strict mode: required-variable WARNINGs become INVALID (exit 1).
  if (flags.strict) {
    for (const detail of details) {
      if (detail.status === STATUS.WARNING && detail.required) {
        detail.status  = STATUS.INVALID;
        detail.message += " (strict mode)";
      }
    }
  }

  // 5. Summary.
  const summary = { ok: 0, missing: 0, empty: 0, invalid: 0, optional: 0, warnings: 0, fatal: 0 };
  for (const detail of details) {
    if      (detail.status === STATUS.OK)       summary.ok       += 1;
    else if (detail.status === STATUS.MISSING)  summary.missing  += 1;
    else if (detail.status === STATUS.EMPTY)    summary.empty    += 1;
    else if (detail.status === STATUS.INVALID)  summary.invalid  += 1;
    else if (detail.status === STATUS.OPTIONAL) summary.optional += 1;
    else if (detail.status === STATUS.WARNING)  summary.warnings += 1;
    else if (detail.status === STATUS.FATAL)    summary.fatal    += 1;
  }
  summary.total = details.length;

  let exitCode = EXIT_CODES.SUCCESS;
  if (summary.fatal > 0)
    exitCode = EXIT_CODES.SECURITY_ERROR;
  else if (summary.missing + summary.empty + summary.invalid > 0)
    exitCode = EXIT_CODES.VALIDATION_ERROR;

  const overall = exitCode === EXIT_CODES.SUCCESS ? "passed" : "failed";

  // 6. Output.
  if (flags.json) {
    const report = {
      status: overall, mode: flags.mode, strict: flags.strict,
      timestamp: new Date().toISOString(),
      summary,
      details: details.map((d) => ({
        name: d.name, status: d.status, required: d.required,
        category: d.category, message: d.message,
      })),
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const detail of details) console.log(formatLine(detail));
    console.log(overall === "passed" ? "ENV CHECK PASSED" : "ENV CHECK FAILED");
  }

  if (isCi) {
    for (const detail of details) emitCi(detail);
  }

  return exitCode;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function main() {
  try {
    const code = run();
    process.exit(code);
  } catch (error) {
    // Safe error path: never include env values.
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`check-env: could not run: ${message}`);
    if (process.env.ENV_CHECK_DEBUG) console.error(error.stack);
    process.exit(EXIT_CODES.INVOCATION_ERROR);
  }
}

main();
