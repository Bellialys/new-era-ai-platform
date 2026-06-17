#!/usr/bin/env node
/**
 * Health check orchestrator for New Era AI Platform.
 *
 * Runs a sequence of npm scripts to verify the project is in a healthy state.
 * Modes control which checks are included and in what order.
 *
 * Usage:
 *   node scripts/health-check.mjs [standard|local|production] [--help] [--version]
 *
 * Exit codes:
 *   0  all checks passed
 *   1  a check script exited non-zero
 *   2  bad invocation or a check could not start
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const ROOT       = join(dirname(fileURLToPath(import.meta.url)), "..");
const VALID_MODES = new Set(["standard", "local", "production"]);

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------
const EXIT_CODES = {
  SUCCESS:       0,
  CHECK_FAILED:  1,
  RUNTIME_ERROR: 2,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const flags = { help: false, version: false, mode: null, unknown: [] };
  for (const arg of argv) {
    switch (arg) {
      case "--help":
      case "-h":
        flags.help = true;
        break;
      case "--version":
      case "-v":
        flags.version = true;
        break;
      default:
        if (arg.startsWith("-")) {
          flags.unknown.push(arg);
        } else if (VALID_MODES.has(arg)) {
          flags.mode = arg;
        } else {
          flags.unknown.push(arg);
        }
    }
  }
  return flags;
}

function showHelp() {
  console.log(
    [
      "Usage: node scripts/health-check.mjs [mode] [options]",
      "",
      "Modes:",
      "  standard     env:check, typecheck, lint, test, test:env-check,",
      "               docs:check, state:check, build  (default)",
      "  local        standard + schema:check (only if SUPABASE_DB_URL is set)",
      "  production   env:check:full, typecheck, lint, test, test:env-check,",
      "               docs:check, state:check, build, models:verify, smoke",
      "",
      "Options:",
      "  --help, -h     Show this help",
      "  --version, -v  Print version from package.json",
      "",
      "Exit codes:",
      "  0  all checks passed",
      "  1  a check script exited non-zero",
      "  2  bad invocation or a check could not start",
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
// Parse and validate
// ---------------------------------------------------------------------------
const flags = parseArgs(process.argv.slice(2));

if (flags.help) {
  showHelp();
  process.exit(EXIT_CODES.SUCCESS);
}
if (flags.version) {
  showVersion();
  process.exit(EXIT_CODES.SUCCESS);
}
if (flags.unknown.length > 0) {
  console.error(
    `health-check: unknown argument(s): ${flags.unknown.join(", ")}. Run with --help.`,
  );
  process.exit(EXIT_CODES.RUNTIME_ERROR);
}

const mode = flags.mode ?? "standard";

// ---------------------------------------------------------------------------
// Environment — loaded so hasEnv() can see values from .env.local
// ---------------------------------------------------------------------------
const isVercel     = !!(process.env.VERCEL || process.env.VERCEL_ENV);
const isProduction = process.env.NODE_ENV === "production" || isVercel;
const isDev        = !isProduction;
const SILENT       = { info: () => {}, error: () => {}, warn: () => {} };

loadEnvConfig(ROOT, isDev, SILENT);

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------
function hasEnv(name) {
  return Boolean(process.env[name] && process.env[name].trim() !== "");
}

function hasAnyEnv(names) {
  return names.some(hasEnv);
}

// ---------------------------------------------------------------------------
// Script runner
// ---------------------------------------------------------------------------
const LABEL = `health:${mode}`;

function runScript(name) {
  console.log(`\n${LABEL}: running npm run ${name}`);
  const start = Date.now();

  const result = spawnSync(`npm run ${name}`, {
    cwd:       ROOT,
    env:       process.env,
    shell:     true,
    stdio:     "inherit",
    maxBuffer: 50 * 1024 * 1024, // 50 MB — prevents truncation on large build output
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (result.error) {
    console.error(
      `${LABEL}: could not start npm run ${name}: ${result.error.code || "SPAWN_ERROR"}`,
    );
    process.exit(EXIT_CODES.RUNTIME_ERROR);
  }

  if (result.status !== 0) {
    console.error(
      `${LABEL}: npm run ${name} failed with exit code ${result.status} (${elapsed}s)`,
    );
    process.exit(result.status ?? EXIT_CODES.CHECK_FAILED);
  }

  console.log(`${LABEL}: npm run ${name} passed (${elapsed}s)`);
}

// ---------------------------------------------------------------------------
// Check suites
// ---------------------------------------------------------------------------
function runStandardChecks() {
  for (const script of [
    "env:check",
    "typecheck",
    "lint",
    "test",
    "test:env-check",
    "docs:check",
    "state:check",
    "build",
  ]) {
    runScript(script);
  }
}

function runLocalChecks() {
  runStandardChecks();

  if (hasAnyEnv(["SUPABASE_DB_URL", "DATABASE_URL"])) {
    runScript("schema:check");
  } else {
    console.log(`\n${LABEL}: skipping schema:check — SUPABASE_DB_URL / DATABASE_URL not set.`);
  }
}

function runProductionChecks() {
  for (const script of [
    "env:check:full",
    "typecheck",
    "lint",
    "test",
    "test:env-check",
    "docs:check",
    "state:check",
    "build",
    "models:verify",
  ]) {
    runScript(script);
  }

  if (!hasAnyEnv(["SMOKE_BASE_URL", "NEXT_PUBLIC_SITE_URL"])) {
    console.error(
      `${LABEL}: set SMOKE_BASE_URL or NEXT_PUBLIC_SITE_URL before running smoke.`,
    );
    process.exit(EXIT_CODES.RUNTIME_ERROR);
  }

  runScript("smoke");
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
const totalStart = Date.now();

if (mode === "local") {
  runLocalChecks();
} else if (mode === "production") {
  runProductionChecks();
} else {
  runStandardChecks();
}

const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
console.log(`\n${LABEL} completed successfully (total: ${totalElapsed}s).`);
