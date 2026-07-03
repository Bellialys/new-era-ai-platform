#!/usr/bin/env node
/**
 * Smoke check for New Era AI Platform.
 *
 * Hits /api/health and /api/models in parallel and verifies both return valid data.
 *
 * Usage:
 *   node scripts/smoke-check.mjs [--url <base>] [--json] [--help] [--version]
 *
 * Environment variables:
 *   SMOKE_BASE_URL        Base URL override (takes priority over NEXT_PUBLIC_SITE_URL)
 *   NEXT_PUBLIC_SITE_URL  Fallback base URL (default: http://localhost:3000)
 *   ALLOW_DEGRADED        Set to "1" to pass when /api/health returns a non-"ok" status
 *   SMOKE_RETRIES         Retry attempts per request (default: 2)
 *   SMOKE_TIMEOUT_MS      Request timeout in ms (default: 10000)
 *   VERCEL_AUTOMATION_BYPASS_SECRET
 *                          Optional Vercel Deployment Protection bypass secret
 *                          sent as an x-vercel-protection-bypass header
 *
 * Exit codes:
 *   0  smoke check passed (or degraded with ALLOW_DEGRADED=1)
 *   1  smoke check failed (network error, validation failure)
 *   2  cannot run: bad invocation or invalid URL
 */

import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------
const EXIT_CODES = {
  PASS:          0,
  FAIL:          1,
  RUNTIME_ERROR: 2,
};

// ---------------------------------------------------------------------------
// Configuration — parseInt avoids the `0 || default` falsy trap
// ---------------------------------------------------------------------------
const _r = parseInt(process.env.SMOKE_RETRIES ?? "", 10);
const RETRIES = Number.isNaN(_r) ? 2 : Math.max(0, _r);
const _t = parseInt(process.env.SMOKE_TIMEOUT_MS ?? "", 10);
const TIMEOUT_MS = Number.isNaN(_t) ? 10_000 : Math.max(1000, _t);
const ALLOW_DEGRADED = process.env.ALLOW_DEGRADED === "1";
const VERCEL_AUTOMATION_BYPASS_SECRET =
  (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
const HAS_VERCEL_AUTOMATION_BYPASS = VERCEL_AUTOMATION_BYPASS_SECRET.length > 0;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const flags = { help: false, version: false, json: false, url: null, unknown: [] };
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
      case "--url": {
        // Accept both --url <value> and --url=<value>
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags.url = next.trim();
          i++;
        } else {
          flags.unknown.push(`${arg} (requires a value, e.g. --url http://localhost:3000)`);
        }
        break;
      }
      default:
        if (arg.startsWith("--url=")) {
          flags.url = arg.slice("--url=".length).trim();
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
      "Usage: node scripts/smoke-check.mjs [options]",
      "",
      "Options:",
      "  --url <url>    Base URL to test (overrides SMOKE_BASE_URL env var)",
      "  --json         Output results as JSON to stdout (for CI pipelines)",
      "  --help, -h     Show this help",
      "  --version, -v  Print version from package.json",
      "",
      "Environment variables:",
      "  SMOKE_BASE_URL        Base URL (default: NEXT_PUBLIC_SITE_URL or http://localhost:3000)",
      "  ALLOW_DEGRADED        Set to \"1\" to pass when /api/health returns a non-\"ok\" status",
      "  SMOKE_RETRIES         Retry attempts per request (default: 2)",
      "  SMOKE_TIMEOUT_MS      Request timeout in ms (default: 10000)",
      "  VERCEL_AUTOMATION_BYPASS_SECRET",
      "                        Optional Vercel Deployment Protection bypass secret",
      "",
      "Exit codes:",
      "  0  smoke check passed (or degraded with ALLOW_DEGRADED=1)",
      "  1  smoke check failed (network error or validation failure)",
      "  2  cannot run: bad invocation or invalid URL",
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
// URL helpers
// ---------------------------------------------------------------------------
function resolveBaseUrl(cliUrl) {
  const raw =
    cliUrl ||
    process.env.SMOKE_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Base URL is empty — cannot run smoke check.");
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`Base URL "${trimmed}" is not a valid URL.`);
  }
  return trimmed;
}

function buildUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

// ---------------------------------------------------------------------------
// HTTP fetch with timeout
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = {
    accept: "application/json",
    ...(HAS_VERCEL_AUTOMATION_BYPASS
      ? { "x-vercel-protection-bypass": VERCEL_AUTOMATION_BYPASS_SECRET }
      : {}),
  };

  try {
    return await fetch(url, {
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Timeout: request to ${url} exceeded ${TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Fetch with retry + exponential back-off
// ---------------------------------------------------------------------------
async function fetchJson(baseUrl, path) {
  const url = buildUrl(baseUrl, path);
  let lastError;

  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    try {
      const response = await fetchWithTimeout(url);
      const text = await response.text();

      if (!response.ok) {
        const preview = text.slice(0, 300).replace(/\s+/g, " ").trim();
        throw new Error(`HTTP ${response.status} ${response.statusText} for ${path} — ${preview}`);
      }

      try {
        return text ? JSON.parse(text) : null;
      } catch {
        const preview = text.slice(0, 200).replace(/\s+/g, " ").trim();
        throw new Error(`Invalid JSON from ${path} — ${preview}`);
      }
    } catch (err) {
      lastError = err;
      const remaining = RETRIES + 1 - attempt;
      if (remaining > 0) {
        const delay = 500 * attempt; // 500ms, 1000ms, ...
        console.error(
          `smoke-check: attempt ${attempt} failed for ${path}: ${err.message} (retrying in ${delay}ms)`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------
function validateHealth(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("/api/health did not return a JSON object.");
  }
  if (body.status !== "ok" && !ALLOW_DEGRADED) {
    throw new Error(
      `/api/health returned status "${body.status}". Set ALLOW_DEGRADED=1 to allow degraded smoke checks.`,
    );
  }
  return body;
}

function validateModels(body) {
  if (!body || typeof body !== "object") {
    throw new Error("/api/models did not return a JSON object.");
  }
  const models = Array.isArray(body.models) ? body.models : [];
  if (models.length === 0) {
    throw new Error("/api/models returned no models.");
  }
  return models;
}

// ---------------------------------------------------------------------------
// Smoke check — returns a result object; throws on failure
// ---------------------------------------------------------------------------
async function runSmoke(baseUrl) {
  const [healthBody, modelsBody] = await Promise.all([
    fetchJson(baseUrl, "/api/health"),
    fetchJson(baseUrl, "/api/models"),
  ]);

  const health = validateHealth(healthBody);
  const models = validateModels(modelsBody);

  return {
    outcome:      health.status === "ok" ? "pass" : "degraded",
    baseUrl,
    healthStatus: health.status,
    modelsCount:  models.length,
    isDegraded:   health.status !== "ok",
    protectionBypass: HAS_VERCEL_AUTOMATION_BYPASS ? "enabled" : "disabled",
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    showHelp();
    return EXIT_CODES.PASS;
  }
  if (flags.version) {
    showVersion();
    return EXIT_CODES.PASS;
  }
  if (flags.unknown.length > 0) {
    console.error(
      `smoke-check: unknown argument(s): ${flags.unknown.join(", ")}. Run with --help.`,
    );
    return EXIT_CODES.RUNTIME_ERROR;
  }

  let baseUrl;
  try {
    baseUrl = resolveBaseUrl(flags.url);
  } catch (err) {
    if (flags.json) {
      console.error(JSON.stringify({ outcome: "error", error: err.message }));
    } else {
      console.error(`smoke-check: ${err.message}`);
    }
    return EXIT_CODES.RUNTIME_ERROR;
  }

  if (!flags.json) {
    console.log(
      `Running smoke check against ${baseUrl} (retries=${RETRIES}, timeout=${TIMEOUT_MS}ms, protectionBypass=${HAS_VERCEL_AUTOMATION_BYPASS ? "enabled" : "disabled"})`,
    );
  }

  try {
    const result = await runSmoke(baseUrl);

    if (flags.json) {
      console.log(
        JSON.stringify(
          { timestamp: new Date().toISOString(), ...result },
          null,
          2,
        ),
      );
    } else if (result.isDegraded) {
      console.error(
        `Smoke check DEGRADED — health: ${result.healthStatus}, models: ${result.modelsCount}`,
      );
    } else {
      console.log(`Smoke check passed — health: ${result.healthStatus}, models: ${result.modelsCount}`);
    }

    return EXIT_CODES.PASS;
  } catch (err) {
    if (flags.json) {
      console.error(
        JSON.stringify(
          { timestamp: new Date().toISOString(), outcome: "fail", baseUrl, error: err.message },
          null,
          2,
        ),
      );
    } else {
      console.error(`Smoke check FAILED: ${err.message}`);
    }
    return EXIT_CODES.FAIL;
  }
}

main()
  .then((code) => {
    // Let the event loop drain naturally. Direct process.exit() can force-close
    // undici fetch sockets and trip UV_HANDLE_CLOSING on Windows / Node >= 24.
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(`smoke-check: unexpected failure: ${err?.message ?? err}`);
    process.exitCode = EXIT_CODES.FAIL;
  });
