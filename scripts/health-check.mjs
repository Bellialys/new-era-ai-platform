#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "standard";
const validModes = new Set(["standard", "local", "production"]);

if (!validModes.has(mode)) {
  console.error(`Unknown health mode "${mode}". Use: standard, local, production.`);
  process.exit(2);
}

loadEnvConfig(ROOT, true, { info: () => {}, error: () => {} });

function hasEnv(name) {
  return Boolean(process.env[name] && process.env[name].trim() !== "");
}

function hasAnyEnv(names) {
  return names.some((name) => hasEnv(name));
}

function runScript(name) {
  console.log(`\nhealth: running npm run ${name}`);
  const result = spawnSync(`npm run ${name}`, {
    cwd: ROOT,
    env: process.env,
    shell: true,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`health: could not start npm run ${name}: ${result.error.code || "SPAWN_ERROR"}`);
    process.exit(2);
  }

  if (result.status !== 0) {
    console.error(`health: npm run ${name} failed with exit code ${result.status}.`);
    process.exit(result.status || 1);
  }
}

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
    console.log("\nhealth:local: skipping schema:check because SUPABASE_DB_URL is not set.");
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
    console.error("health:production: set SMOKE_BASE_URL or NEXT_PUBLIC_SITE_URL before running smoke.");
    process.exit(2);
  }

  runScript("smoke");
}

if (mode === "local") {
  runLocalChecks();
} else if (mode === "production") {
  runProductionChecks();
} else {
  runStandardChecks();
}

console.log(`\nhealth:${mode} completed successfully.`);
