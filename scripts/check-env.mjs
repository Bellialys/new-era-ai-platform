#!/usr/bin/env node
/**
 * Environment Variables Checker for New Era AI Platform.
 *
 * SECURITY CONTRACT (see docs/34-env-check-policy.md):
 *   - never prints a variable value, not even partially;
 *   - never prints the length of a value;
 *   - never prints a JWT payload or claims;
 *   - never does console.log(process.env) or JSON.stringify(process.env);
 *   - never writes secrets to reports or temp files.
 * Output is limited to variable NAMES and statuses, which is safe to share.
 *
 * Usage:
 *   node scripts/check-env.mjs [--mode=basic|migrations|full] [--json] [--ci]
 *   node scripts/check-env.mjs --generate-example
 *
 * Exit codes:
 *   0  success
 *   1  missing / empty / invalid required variables
 *   2  bad invocation (e.g. unknown --mode) or unexpected script error
 *   3  security risk (potential secret leak, or .env.local not gitignored)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const SCRIPT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// baseDir is where .env.local / .gitignore / .env.local.example live.
// Overridable via ENV_CHECK_DIR for tests; defaults to the project root.
const BASE_DIR = process.env.ENV_CHECK_DIR || SCRIPT_ROOT;
const CONFIG_PATH = join(SCRIPT_ROOT, "env-check.config.json");

const VALID_MODES = ["basic", "migrations", "full"];

// Words that must never appear in a NEXT_PUBLIC_ (client-exposed) variable name.
const DANGEROUS_WORDS = [
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "DATABASE",
  "SERVICE_ROLE",
  "PRIVATE",
  "OPENROUTER",
];

// Status constants.
const S = {
  OK: "ok",
  MISSING: "missing",
  EMPTY: "empty",
  INVALID: "invalid",
  OPTIONAL: "optional",
  WARNING: "warning",
  FATAL: "fatal",
};

function parseArgs(argv) {
  const flags = { mode: "basic", json: false, ci: false, generateExample: false };
  for (const arg of argv) {
    if (arg.startsWith("--mode=")) flags.mode = arg.slice("--mode=".length);
    else if (arg === "--json") flags.json = true;
    else if (arg === "--ci") flags.ci = true;
    else if (arg === "--generate-example") flags.generateExample = true;
    // Unknown flags are ignored on purpose (npm may forward extras).
  }
  return flags;
}

function loadConfig() {
  const raw = readFileSync(CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  if (!config || !Array.isArray(config.variables)) {
    throw new Error("env-check.config.json is missing a variables array");
  }
  return config;
}

/** Resolve a variable value via its primary name or any alias. Returns the raw value or undefined. */
function resolveValue(variable) {
  const names = [variable.name, ...(variable.aliases || [])];
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Decode a JWT payload without verifying the signature. Returns the parsed object or null. Never logs. */
function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Validate a value against a variable's validation rule. Returns { ok, message }. Never echoes the value. */
function validateValue(variable, value) {
  const rule = variable.validation || { type: "nonEmptyString" };

  if (rule.type === "nonEmptyString") {
    return { ok: true, message: "exists" };
  }

  if (rule.type === "regex") {
    const ok = new RegExp(rule.pattern).test(value);
    return ok ? { ok: true, message: "exists" } : { ok: false, message: rule.message };
  }

  if (rule.type === "supabaseServiceRoleJwt") {
    // New-style Supabase secret keys are not JWTs; accept their format as-is.
    if (value.startsWith("sb_secret_")) {
      return { ok: true, message: "exists" };
    }
    if (!value.startsWith("eyJ")) {
      return { ok: false, message: "must be a valid JWT-like value" };
    }
    const payload = decodeJwtPayload(value);
    if (!payload) {
      return { ok: false, message: "must be a valid JWT-like value" };
    }
    if (payload.role === "anon") {
      return { ok: false, message: "must be service_role, not anon" };
    }
    if (payload.role && payload.role !== "service_role") {
      // Decodes but is not clearly service_role — surface as a soft warning.
      return { ok: true, warn: true, message: "could not confirm service_role claim" };
    }
    return { ok: true, message: "exists" };
  }

  // Unknown validation type: do not block.
  return { ok: true, message: "exists" };
}

/** Build the per-variable result without ever touching the value text in the output. */
function checkVariable(variable) {
  const value = resolveValue(variable);
  const base = { name: variable.name, required: !!variable.required, category: variable.category };

  if (value === undefined) {
    return variable.required
      ? { ...base, status: S.MISSING, message: "is required" }
      : { ...base, status: S.OPTIONAL, message: "is not set (optional)" };
  }

  if (value.trim() === "") {
    return variable.required
      ? { ...base, status: S.EMPTY, message: "is required but empty" }
      : { ...base, status: S.OPTIONAL, message: "is not set (optional)" };
  }

  const result = validateValue(variable, value);
  if (!result.ok) {
    return variable.required
      ? { ...base, status: S.INVALID, message: result.message }
      : { ...base, status: S.WARNING, message: result.message };
  }
  if (result.warn) {
    return { ...base, status: S.WARNING, message: result.message };
  }
  return { ...base, status: S.OK, message: "exists" };
}

/** Scan every NEXT_PUBLIC_ variable for a dangerous word in its NAME. Returns fatal detail entries. */
function detectLeaks() {
  const fatals = [];
  for (const name of Object.keys(process.env)) {
    if (!name.startsWith("NEXT_PUBLIC_")) continue;
    const upper = name.toUpperCase();
    if (DANGEROUS_WORDS.some((word) => upper.includes(word))) {
      fatals.push({
        name,
        status: S.FATAL,
        required: false,
        category: "security",
        message: `Potential secret exposed to client: ${name} must not be public`,
      });
    }
  }
  return fatals;
}

function isEnvLocalIgnored() {
  const gitignorePath = join(BASE_DIR, ".gitignore");
  if (!existsSync(gitignorePath)) return false;
  const lines = readFileSync(gitignorePath, "utf8").split(/\r?\n/).map((l) => l.trim());
  return lines.some(
    (line) =>
      line === ".env.local" ||
      line === ".env*.local" ||
      (line.startsWith(".env") && line.includes(".local") && line.includes("*"))
  );
}

/** Detect duplicate keys in .env.local. Returns variable NAMES only — never values. */
function findDuplicateKeys() {
  const envLocalPath = join(BASE_DIR, ".env.local");
  if (!existsSync(envLocalPath)) return [];
  const counts = new Map();
  for (const line of readFileSync(envLocalPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) continue;
    const key = match[1];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key);
}

/** One safe line per detail. WARNING/FATAL carry a full message; others are "STATUS: NAME ...". */
function formatLine(detail) {
  const label = detail.status.toUpperCase();
  if (detail.status === S.OK) return `OK: ${detail.name} exists`;
  if (detail.status === S.WARNING || detail.status === S.FATAL) return `${label}: ${detail.message}`;
  return `${label}: ${detail.name} ${detail.message}`;
}

function emitCi(detail) {
  if ([S.MISSING, S.EMPTY, S.INVALID, S.FATAL].includes(detail.status)) {
    console.log(`::error::${formatLine(detail)}`);
  } else if (detail.status === S.WARNING) {
    console.log(`::warning::${formatLine(detail)}`);
  }
}

function generateExample(config) {
  const lines = [
    "# .env.local.example — generated by `npm run env:check:example`.",
    "# Placeholder values only. Never put real secrets here.",
    "# Copy to .env.local and replace placeholders with real values locally.",
    "",
  ];
  let lastCategory = null;
  for (const variable of config.variables) {
    if (variable.category !== lastCategory) {
      lines.push(`# ${variable.category} variables`);
      lastCategory = variable.category;
    }
    lines.push(`${variable.name}=${variable.example ?? ""}`);
  }
  const outPath = join(BASE_DIR, ".env.local.example");
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  return outPath;
}

function run() {
  const flags = parseArgs(process.argv.slice(2));
  const isCi = flags.ci || process.env.CI === "true";

  const config = loadConfig();

  // --- generate-example: never reads process.env values --------------------
  if (flags.generateExample) {
    generateExample(config);
    console.log(`Generated .env.local.example (${config.variables.length} variables, placeholders only).`);
    return 0;
  }

  if (!VALID_MODES.includes(flags.mode)) {
    console.error(`ERROR: invalid --mode "${flags.mode}". Use one of: ${VALID_MODES.join(", ")}.`);
    return 2;
  }

  // Load env files the same way Next.js does (silent logger, no value output).
  const envLocalExisted = existsSync(join(BASE_DIR, ".env.local"));
  const silentLogger = { info: () => {}, error: () => {}, warn: () => {} };
  loadEnvConfig(BASE_DIR, true, silentLogger);

  const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
  const isProduction = process.env.NODE_ENV === "production" || isVercel;

  const details = [];

  // --- security: leak detection (FATAL / exit 3) ---------------------------
  details.push(...detectLeaks());

  if (!isEnvLocalIgnored()) {
    details.push({
      name: ".env.local",
      status: S.FATAL,
      required: false,
      category: "security",
      message: ".env.local must be ignored by Git",
    });
  }

  // --- required/optional variables for the selected mode -------------------
  const inMode = config.variables.filter(
    (v) => Array.isArray(v.groups) && v.groups.includes(flags.mode)
  );
  for (const variable of inMode) {
    details.push(checkVariable(variable));
  }

  // --- non-blocking warnings -----------------------------------------------
  if (!envLocalExisted && !isCi && !isProduction) {
    details.push({
      name: ".env.local",
      status: S.WARNING,
      required: false,
      category: "local",
      message: ".env.local file not found",
    });
  }

  for (const key of findDuplicateKeys()) {
    details.push({
      name: key,
      status: S.WARNING,
      required: false,
      category: "local",
      message: `${key} defined multiple times in .env.local`,
    });
  }

  // --- summary + exit code -------------------------------------------------
  const summary = { ok: 0, missing: 0, empty: 0, invalid: 0, optional: 0, warnings: 0, fatal: 0 };
  for (const detail of details) {
    if (detail.status === S.OK) summary.ok += 1;
    else if (detail.status === S.MISSING) summary.missing += 1;
    else if (detail.status === S.EMPTY) summary.empty += 1;
    else if (detail.status === S.INVALID) summary.invalid += 1;
    else if (detail.status === S.OPTIONAL) summary.optional += 1;
    else if (detail.status === S.WARNING) summary.warnings += 1;
    else if (detail.status === S.FATAL) summary.fatal += 1;
  }

  let exitCode = 0;
  if (summary.fatal > 0) exitCode = 3;
  else if (summary.missing + summary.empty + summary.invalid > 0) exitCode = 1;

  const overall = exitCode === 0 ? "passed" : "failed";

  // --- output ---------------------------------------------------------------
  if (flags.json) {
    const report = {
      status: overall,
      mode: flags.mode,
      summary,
      details: details.map((d) => ({
        name: d.name,
        status: d.status,
        required: d.required,
        category: d.category,
        message: d.message,
      })),
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const detail of details) {
      console.log(formatLine(detail));
    }
    console.log(overall === "passed" ? "ENV CHECK PASSED" : "ENV CHECK FAILED");
  }

  if (isCi) {
    for (const detail of details) emitCi(detail);
  }

  return exitCode;
}

function main() {
  try {
    const code = run();
    process.exit(code);
  } catch (error) {
    // Safe error path: never include env values. Only the error name/message of
    // a non-env failure (e.g. missing config file) is shown.
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`ERROR: environment check could not run: ${message}`);
    process.exit(2);
  }
}

main();
