#!/usr/bin/env node
/**
 * Verifies that all locally defined OpenRouter model IDs exist in the live API.
 *
 *   node scripts/verify-models.mjs [--json] [--help] [--version]
 *
 * Environment variables (read from .env.local):
 *   OPENROUTER_API_KEY     Required
 *   MODELS_FILE_PATH       Optional path override for models.ts
 *   VERIFY_MODELS_DEBUG=1  Print stack traces on unexpected errors
 *
 * Exit codes:
 *   0  all local model IDs found in OpenRouter
 *   1  one or more local IDs missing from the live API, or no IDs found
 *   2  cannot run (missing API key, file not found, network error)
 */

import { readFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import ts from "typescript";

const { loadEnvConfig } = nextEnv;

const ROOT                = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MODELS_FILE = join(ROOT, "src", "lib", "server", "models.ts");
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const FETCH_TIMEOUT_MS    = 15_000;
const FETCH_MAX_ATTEMPTS  = 3;

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------
const EXIT_CODES = {
  PASS:          0,
  MISSING:       1,
  RUNTIME_ERROR: 2,
};

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const flags = { help: false, version: false, json: false, unknown: [] };
  for (const arg of argv) {
    switch (arg) {
      case "--help":    case "-h": flags.help    = true; break;
      case "--version": case "-v": flags.version = true; break;
      case "--json":               flags.json    = true; break;
      default: flags.unknown.push(arg);
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Help / version
// ---------------------------------------------------------------------------
function showHelp() {
  console.log(`
Usage: node scripts/verify-models.mjs [options]

Reads ALLOWED_MODELS from src/lib/server/models.ts and verifies every model ID
exists in the live OpenRouter API.

Options:
  --json         Output results as JSON
  --help, -h     Show this help
  --version, -v  Show version

Environment variables (read from .env.local):
  OPENROUTER_API_KEY     Required
  MODELS_FILE_PATH       Optional path override for models.ts
  VERIFY_MODELS_DEBUG=1  Print stack traces on unexpected errors

Exit codes:
  0  all local model IDs are available on OpenRouter
  1  one or more local IDs are missing from the live API
  2  cannot run (missing API key, file not found, or network error)
`);
}

function showVersion() {
  const pkgPath = join(ROOT, "package.json");
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
// AST extraction -- direct scan, supports [{id:"..."}] and ["..."] formats
// ---------------------------------------------------------------------------
function extractModelIds(sourceFile) {
  const ids = [];
  let foundDeclaration = false;

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "ALLOWED_MODELS") continue;
      foundDeclaration = true;
      if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
      for (const element of declaration.initializer.elements) {
        if (ts.isObjectLiteralExpression(element)) {
          for (const prop of element.properties) {
            if (
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === "id" &&
              ts.isStringLiteral(prop.initializer)
            ) {
              ids.push(prop.initializer.text);
            }
          }
        } else if (ts.isStringLiteral(element)) {
          ids.push(element.text);
        }
      }
    }
  });

  if (!foundDeclaration) {
    throw new Error("ALLOWED_MODELS declaration not found in models.ts.");
  }

  return [...new Set(ids)].sort();
}

async function readLocalModelIds(modelsFile) {
  let sourceText;
  try {
    sourceText = await readFile(modelsFile, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      const error = new Error(`Models file not found: ${modelsFile}`);
      error.exitCode = EXIT_CODES.RUNTIME_ERROR;
      throw error;
    }
    throw err;
  }
  const sourceFile = ts.createSourceFile(modelsFile, sourceText, ts.ScriptTarget.Latest, true);
  return extractModelIds(sourceFile);
}

// ---------------------------------------------------------------------------
// OpenRouter API -- with retry on transient failures
// ---------------------------------------------------------------------------
const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchOpenRouterModelIds(apiKey) {
  let lastErr;

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(OPENROUTER_MODELS_URL, {
        headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Authentication errors are not retriable.
          throw new Error(`OpenRouter auth failed (HTTP ${response.status}). Check OPENROUTER_API_KEY.`);
        }
        if (RETRIABLE_STATUS.has(response.status) && attempt < FETCH_MAX_ATTEMPTS) {
          lastErr = new Error(`OpenRouter API returned HTTP ${response.status} (attempt ${attempt}).`);
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        throw new Error(`OpenRouter API returned HTTP ${response.status}.`);
      }

      const body = await response.json();
      const models = Array.isArray(body?.data) ? body.data : [];
      return new Set(models.map((m) => m?.id).filter((id) => typeof id === "string"));
    } catch (err) {
      if (err.name === "AbortError") {
        lastErr = new Error(`OpenRouter request timed out after ${FETCH_TIMEOUT_MS}ms (attempt ${attempt}).`);
        if (attempt < FETCH_MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        throw lastErr;
      }
      // Non-retriable errors (auth, parse, etc.) propagate immediately.
      if (!lastErr) throw err;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr ?? new Error("OpenRouter fetch failed after all attempts.");
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
    console.error(`verify-models: unknown argument(s): ${flags.unknown.join(", ")}. Run with --help.`);
    return EXIT_CODES.RUNTIME_ERROR;
  }

  // Environment: determine isDev BEFORE loadEnvConfig so platform variables
  // (VERCEL, NODE_ENV) are read from the real environment, not from .env files.
  const isVercel     = !!(process.env.VERCEL || process.env.VERCEL_ENV);
  const isProduction = process.env.NODE_ENV === "production" || isVercel;
  const isDev        = !isProduction;
  const SILENT       = { info: () => {}, error: () => {}, warn: () => {} };
  loadEnvConfig(ROOT, isDev, SILENT);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey?.trim()) {
    console.error("OPENROUTER_API_KEY is not set. Add it to .env.local.");
    return EXIT_CODES.RUNTIME_ERROR;
  }

  const modelsFile = process.env.MODELS_FILE_PATH || DEFAULT_MODELS_FILE;

  let localIds;
  try {
    localIds = await readLocalModelIds(modelsFile);
  } catch (err) {
    console.error(`verify-models: ${err.message}`);
    if (process.env.VERIFY_MODELS_DEBUG) console.error(err.stack ?? "");
    return err.exitCode ?? EXIT_CODES.RUNTIME_ERROR;
  }

  if (localIds.length === 0) {
    const message = "No model IDs found in ALLOWED_MODELS. Check src/lib/server/models.ts.";
    if (flags.json) {
      console.log(JSON.stringify({ status: "fail", reason: "no_local_models", message, localCount: 0, missing: [] }));
    } else {
      console.error(message);
    }
    return EXIT_CODES.MISSING;
  }

  const startMs = Date.now();
  let liveIds;
  try {
    liveIds = await fetchOpenRouterModelIds(apiKey);
  } catch (err) {
    const message = `OpenRouter fetch error: ${err.message}`;
    if (flags.json) {
      console.log(JSON.stringify({ status: "error", reason: "fetch_failed", message }));
    } else {
      console.error(message);
    }
    if (process.env.VERIFY_MODELS_DEBUG) console.error(err.stack ?? "");
    return EXIT_CODES.RUNTIME_ERROR;
  }
  const fetchMs = Date.now() - startMs;

  const missing = localIds.filter((id) => !liveIds.has(id));
  const passed  = missing.length === 0;

  if (flags.json) {
    console.log(JSON.stringify({
      status:     passed ? "pass" : "fail",
      localCount: localIds.length,
      liveCount:  liveIds.size,
      missing,
      fetchMs,
    }));
  } else if (passed) {
    console.log(`OpenRouter model verification passed (${localIds.length} local model IDs, ${fetchMs}ms).`);
  } else {
    console.error(`OpenRouter model verification failed. ${missing.length} model ID(s) missing from API:`);
    for (const id of missing) console.error(`  - ${id}`);
  }

  return passed ? EXIT_CODES.PASS : EXIT_CODES.MISSING;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err?.message || "verify-models: unexpected failure.");
    if (process.env.VERIFY_MODELS_DEBUG) console.error(err?.stack ?? "");
    process.exit(EXIT_CODES.RUNTIME_ERROR);
  });
