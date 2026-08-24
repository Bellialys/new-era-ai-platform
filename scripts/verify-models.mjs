#!/usr/bin/env node
/**
 * Verifies all locally selected OpenRouter text and image models against the
 * provider discovery APIs.
 *
 *   node scripts/verify-models.mjs [--json] [--help] [--version]
 *
 * Exit codes:
 *   0  all catalogs and runtime defaults are valid
 *   1  provider drift or a local catalog invariant failed
 *   2  verifier could not run (configuration, file, or network failure)
 */

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import ts from "typescript";

const { loadEnvConfig } = nextEnv;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const OPENROUTER_TEXT_MODELS_URL =
  "https://openrouter.ai/api/v1/models?output_modalities=text";
export const OPENROUTER_IMAGE_MODELS_URL =
  "https://openrouter.ai/api/v1/images/models";

const DEFAULT_CATALOG_PATHS = Object.freeze({
  models: join(ROOT, "src", "lib", "server", "models.ts"),
  teamMode: join(ROOT, "src", "lib", "arena", "team-mode.ts"),
  constants: join(ROOT, "src", "lib", "arena", "constants.ts"),
  imageModels: join(ROOT, "src", "lib", "arena", "image-models.ts"),
});

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_MAX_ATTEMPTS = 3;
const REQUIRED_IMAGE_PARAMETERS = Object.freeze(["aspect_ratio", "n"]);
const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export const EXIT_CODES = Object.freeze({
  PASS: 0,
  MISSING: 1,
  RUNTIME_ERROR: 2,
});

export function parseArgs(argv) {
  const flags = { help: false, version: false, json: false, unknown: [] };

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
      case "--json":
        flags.json = true;
        break;
      default:
        flags.unknown.push(arg);
    }
  }

  return flags;
}

function helpText() {
  return `Usage: node scripts/verify-models.mjs [options]

Verifies the local text catalog, Team default, Judge primary/fallback, and
Image catalog against the authenticated OpenRouter discovery APIs.

Options:
  --json         Output a deterministic JSON result
  --help, -h     Show this help
  --version, -v  Show version

Environment variables (read from .env.local):
  OPENROUTER_API_KEY          Required
  MODELS_FILE_PATH            Optional models.ts path override
  TEAM_MODE_FILE_PATH         Optional team-mode.ts path override
  ARENA_CONSTANTS_FILE_PATH   Optional constants.ts path override
  IMAGE_MODELS_FILE_PATH      Optional image-models.ts path override
  VERIFY_MODELS_DEBUG=1       Print stack traces on unexpected errors

Exit codes:
  0  all catalogs and defaults are valid
  1  provider drift or a local invariant was found
  2  verifier could not run
`;
}

function packageVersion() {
  const pkgPath = join(ROOT, "package.json");
  if (!existsSync(pkgPath)) return "unknown (no package.json)";

  try {
    return JSON.parse(readFileSync(pkgPath, "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

function unwrapExpression(expression) {
  let current = expression;

  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function stringLiteralValue(expression) {
  const value = unwrapExpression(expression);
  if (!value) return null;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return value.text;
  }
  return null;
}

function numericLiteralValue(expression) {
  const value = unwrapExpression(expression);
  if (!value || !ts.isNumericLiteral(value)) return null;
  return Number(value.text);
}

function findVariableDeclaration(sourceFile, declarationName) {
  let match = null;

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isVariableStatement(node)) return;

    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === declarationName) {
        match = declaration;
      }
    }
  });

  return match;
}

/** Extracts literal IDs from an array of strings or objects with literal id fields. */
export function extractArrayIds(sourceFile, declarationName) {
  const declaration = findVariableDeclaration(sourceFile, declarationName);
  if (!declaration) {
    throw new Error(`${declarationName} declaration not found.`);
  }

  const initializer = declaration.initializer && unwrapExpression(declaration.initializer);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
    throw new Error(`${declarationName} must be a literal array.`);
  }

  const ids = [];
  for (const rawElement of initializer.elements) {
    const element = unwrapExpression(rawElement);
    const directId = stringLiteralValue(element);
    if (directId !== null) {
      ids.push(directId);
      continue;
    }

    if (!ts.isObjectLiteralExpression(element)) {
      throw new Error(`${declarationName} contains a non-literal entry.`);
    }

    const idProperty = element.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) && propertyNameText(property.name) === "id",
    );
    if (!idProperty || !ts.isPropertyAssignment(idProperty)) {
      throw new Error(`${declarationName} contains an entry without a literal id.`);
    }

    const id = stringLiteralValue(idProperty.initializer);
    if (id === null) {
      throw new Error(`${declarationName} contains an entry without a literal id.`);
    }
    ids.push(id);
  }

  return ids;
}

/** Extracts a direct string constant or a literal object property by name. */
export function extractStringConstant(sourceFile, constantName) {
  const declaration = findVariableDeclaration(sourceFile, constantName);
  if (declaration) {
    const value = declaration.initializer && stringLiteralValue(declaration.initializer);
    if (value === null) {
      throw new Error(`${constantName} must be a literal string.`);
    }
    return value;
  }

  const matches = [];
  let foundNonLiteral = false;

  function visit(node) {
    if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === constantName) {
      const value = stringLiteralValue(node.initializer);
      if (value === null) {
        foundNonLiteral = true;
      } else {
        matches.push(value);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (foundNonLiteral) {
    throw new Error(`${constantName} must be a literal string.`);
  }
  if (matches.length === 0) {
    throw new Error(`${constantName} declaration not found.`);
  }
  if (new Set(matches).size !== 1) {
    throw new Error(`${constantName} has conflicting literal values.`);
  }

  return matches[0];
}

/** Extracts a direct numeric constant or a literal object property by name. */
export function extractNumberConstant(sourceFile, constantName) {
  const declaration = findVariableDeclaration(sourceFile, constantName);
  if (declaration) {
    const value = declaration.initializer && numericLiteralValue(declaration.initializer);
    if (value === null || !Number.isFinite(value)) {
      throw new Error(`${constantName} must be a numeric literal.`);
    }
    return value;
  }

  const matches = [];
  let foundNonLiteral = false;

  function visit(node) {
    if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === constantName) {
      const value = numericLiteralValue(node.initializer);
      if (value === null || !Number.isFinite(value)) {
        foundNonLiteral = true;
      } else {
        matches.push(value);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (foundNonLiteral) {
    throw new Error(`${constantName} must be a numeric literal.`);
  }
  if (matches.length === 0) {
    throw new Error(`${constantName} declaration not found.`);
  }
  if (new Set(matches).size !== 1) {
    throw new Error(`${constantName} has conflicting literal values.`);
  }

  return matches[0];
}

export function parseTypeScript(sourceText, fileName = "catalog.ts") {
  return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
}

export function extractCatalogFromSources(sources) {
  const modelsSource = parseTypeScript(sources.models, "models.ts");
  const teamModeSource = parseTypeScript(sources.teamMode, "team-mode.ts");
  const constantsSource = parseTypeScript(sources.constants, "constants.ts");
  const imageModelsSource = parseTypeScript(sources.imageModels, "image-models.ts");

  return {
    textIds: extractArrayIds(modelsSource, "ALLOWED_MODELS"),
    modelMinSelect: extractNumberConstant(constantsSource, "MODEL_MIN_SELECT"),
    defaults: {
      team: extractStringConstant(teamModeSource, "TEAM_DEFAULT_MODEL_ID"),
      judgePrimary: extractStringConstant(constantsSource, "JUDGE_PRIMARY_MODEL_ID"),
      judgeFallback: extractStringConstant(constantsSource, "JUDGE_FALLBACK_MODEL_ID"),
    },
    imageIds: extractArrayIds(imageModelsSource, "IMAGE_MODELS"),
  };
}

function catalogPathsFromEnv(env) {
  return {
    models: env.MODELS_FILE_PATH || DEFAULT_CATALOG_PATHS.models,
    teamMode: env.TEAM_MODE_FILE_PATH || DEFAULT_CATALOG_PATHS.teamMode,
    constants: env.ARENA_CONSTANTS_FILE_PATH || DEFAULT_CATALOG_PATHS.constants,
    imageModels: env.IMAGE_MODELS_FILE_PATH || DEFAULT_CATALOG_PATHS.imageModels,
  };
}

export async function readLocalCatalog(paths) {
  const entries = Object.entries(paths);
  const sourceEntries = await Promise.all(
    entries.map(async ([name, path]) => {
      try {
        return [name, await readFile(path, "utf8")];
      } catch (error) {
        if (error?.code === "ENOENT") {
          throw new Error(`Catalog file not found: ${path}`);
        }
        throw error;
      }
    }),
  );

  return extractCatalogFromSources(Object.fromEntries(sourceEntries));
}

const defaultDelay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

export async function fetchJsonWithRetry(
  url,
  apiKey,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = FETCH_TIMEOUT_MS,
    maxAttempts = FETCH_MAX_ATTEMPTS,
    delay = defaultDelay,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `OpenRouter auth failed (HTTP ${response.status}). Check OPENROUTER_API_KEY.`,
          );
        }

        const responseError = new Error(
          `OpenRouter API returned HTTP ${response.status} for ${url}.`,
        );
        if (RETRIABLE_STATUS.has(response.status) && attempt < maxAttempts) {
          lastError = responseError;
          await delay(500 * attempt);
          continue;
        }
        throw responseError;
      }

      try {
        return await response.json();
      } catch {
        throw new Error(`OpenRouter returned invalid JSON for ${url}.`);
      }
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      const networkFailure = error instanceof TypeError;
      lastError = timedOut
        ? new Error(`OpenRouter request timed out after ${timeoutMs}ms for ${url}.`)
        : error;

      if ((timedOut || networkFailure) && attempt < maxAttempts) {
        await delay(500 * attempt);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`OpenRouter fetch failed for ${url}.`);
}

export function normalizeLiveModels(body, endpointName) {
  if (!Array.isArray(body?.data)) {
    throw new Error(`OpenRouter ${endpointName} response is missing a data array.`);
  }

  const models = new Map();
  for (const [index, model] of body.data.entries()) {
    if (
      !model ||
      typeof model !== "object" ||
      Array.isArray(model) ||
      typeof model.id !== "string" ||
      model.id.trim() === "" ||
      model.id !== model.id.trim()
    ) {
      throw new Error(
        `OpenRouter ${endpointName} response contains a malformed model at data[${index}].`,
      );
    }
    if (models.has(model.id)) {
      throw new Error(
        `OpenRouter ${endpointName} response contains duplicate model ID: ${model.id}.`,
      );
    }
    models.set(model.id, model);
  }
  return models;
}

export async function fetchOpenRouterCatalogs(apiKey, options = {}) {
  const [textBody, imageBody] = await Promise.all([
    fetchJsonWithRetry(OPENROUTER_TEXT_MODELS_URL, apiKey, options),
    fetchJsonWithRetry(OPENROUTER_IMAGE_MODELS_URL, apiKey, options),
  ]);

  return {
    textModels: normalizeLiveModels(textBody, "text models"),
    imageModels: normalizeLiveModels(imageBody, "image models"),
  };
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function emptyIdValues(values) {
  return values
    .filter((value) => typeof value !== "string" || value.trim() === "")
    .map((value) => (typeof value === "string" ? value : String(value)))
    .sort((left, right) => left.localeCompare(right));
}

function nonEmptyIds(values) {
  return values.filter((value) => typeof value === "string" && value.trim() !== "");
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((left, right) => left.localeCompare(right));
}

function defaultStatus(id, localTextIds, liveTextModels) {
  return {
    id,
    inLocalTextCatalog: localTextIds.has(id),
    inLiveTextCatalog: liveTextModels.has(id),
  };
}

export function evaluateCatalogs(catalog, liveTextModels, liveImageModels) {
  const textIds = sortedUnique(nonEmptyIds(catalog.textIds));
  const imageIds = sortedUnique(nonEmptyIds(catalog.imageIds));
  const localTextIds = new Set(textIds);

  const defaultChecks = {
    team: defaultStatus(catalog.defaults.team, localTextIds, liveTextModels),
    judgePrimary: defaultStatus(
      catalog.defaults.judgePrimary,
      localTextIds,
      liveTextModels,
    ),
    judgeFallback: defaultStatus(
      catalog.defaults.judgeFallback,
      localTextIds,
      liveTextModels,
    ),
  };
  const defaults = {
    ...defaultChecks,
    emptyIds: Object.entries(catalog.defaults)
      .filter(([, id]) => typeof id !== "string" || id.trim() === "")
      .map(([name]) => name)
      .sort((left, right) => left.localeCompare(right)),
    judgeModelsDistinct:
      catalog.defaults.judgePrimary !== catalog.defaults.judgeFallback,
  };

  const invalidTextOutputModality = [];
  const invalidOutputModality = [];
  const missingRequiredParameters = [];

  for (const id of textIds) {
    const model = liveTextModels.get(id);
    if (!model) continue;

    const outputModalities = Array.isArray(model?.architecture?.output_modalities)
      ? model.architecture.output_modalities
      : [];
    if (!outputModalities.includes("text")) {
      invalidTextOutputModality.push(id);
    }
  }

  for (const id of imageIds) {
    const model = liveImageModels.get(id);
    if (!model) continue;

    const outputModalities = Array.isArray(model?.architecture?.output_modalities)
      ? model.architecture.output_modalities
      : [];
    if (!outputModalities.includes("image")) {
      invalidOutputModality.push(id);
    }

    const rawSupportedParameters = model?.supported_parameters;
    const supportedParameters = new Set(
      Array.isArray(rawSupportedParameters)
        ? rawSupportedParameters
        : rawSupportedParameters && typeof rawSupportedParameters === "object"
          ? Object.keys(rawSupportedParameters)
          : [],
    );
    const missing = REQUIRED_IMAGE_PARAMETERS.filter(
      (parameter) => !supportedParameters.has(parameter),
    );
    if (missing.length > 0) {
      missingRequiredParameters.push({ id, missing });
    }
  }

  const text = {
    localCount: textIds.length,
    liveCount: liveTextModels.size,
    minimumRequired: catalog.modelMinSelect,
    minimumSatisfied:
      Number.isInteger(catalog.modelMinSelect) &&
      catalog.modelMinSelect >= 2 &&
      textIds.length >= catalog.modelMinSelect,
    missing: textIds.filter((id) => !liveTextModels.has(id)),
    duplicates: duplicateValues(catalog.textIds),
    emptyIds: emptyIdValues(catalog.textIds),
    invalidOutputModality: invalidTextOutputModality,
  };
  const images = {
    localCount: imageIds.length,
    liveCount: liveImageModels.size,
    missing: imageIds.filter((id) => !liveImageModels.has(id)),
    duplicates: duplicateValues(catalog.imageIds),
    emptyIds: emptyIdValues(catalog.imageIds),
    invalidOutputModality,
    missingRequiredParameters,
  };

  const defaultsPass = Object.values(defaultChecks).every(
    (entry) => entry.inLocalTextCatalog && entry.inLiveTextCatalog,
  );
  const passed =
    text.minimumSatisfied &&
    images.localCount > 0 &&
    text.missing.length === 0 &&
    text.duplicates.length === 0 &&
    text.emptyIds.length === 0 &&
    text.invalidOutputModality.length === 0 &&
    images.missing.length === 0 &&
    images.duplicates.length === 0 &&
    images.emptyIds.length === 0 &&
    images.invalidOutputModality.length === 0 &&
    images.missingRequiredParameters.length === 0 &&
    defaultsPass &&
    defaults.emptyIds.length === 0 &&
    defaults.judgeModelsDistinct;

  return {
    status: passed ? "pass" : "fail",
    text,
    defaults,
    images,
  };
}

function printHumanResult(result, stdout, stderr) {
  if (result.status === "pass") {
    stdout(
      `OpenRouter model verification passed (${result.text.localCount} text, ${result.images.localCount} image).`,
    );
    return;
  }

  stderr("OpenRouter model verification failed.");
  if (!result.text.minimumSatisfied) {
    stderr(
      `  - ALLOWED_MODELS has ${result.text.localCount} valid IDs; minimum is ${result.text.minimumRequired} (floor 2).`,
    );
  }
  for (const id of result.text.missing) stderr(`  - missing text model: ${id}`);
  for (const id of result.text.duplicates) stderr(`  - duplicate text model: ${id}`);
  for (const id of result.text.emptyIds) stderr(`  - empty text model ID: ${JSON.stringify(id)}`);
  for (const id of result.text.invalidOutputModality) {
    stderr(`  - text model does not advertise text output: ${id}`);
  }

  for (const name of ["team", "judgePrimary", "judgeFallback"]) {
    const entry = result.defaults[name];
    if (!entry.inLocalTextCatalog) stderr(`  - ${name} is not in ALLOWED_MODELS: ${entry.id}`);
    if (!entry.inLiveTextCatalog) stderr(`  - ${name} is not live: ${entry.id}`);
  }
  for (const name of result.defaults.emptyIds) stderr(`  - ${name} has an empty model ID.`);
  if (!result.defaults.judgeModelsDistinct) {
    stderr("  - Judge primary and fallback model IDs must differ.");
  }

  if (result.images.localCount === 0) stderr("  - IMAGE_MODELS is empty.");
  for (const id of result.images.missing) stderr(`  - missing image model: ${id}`);
  for (const id of result.images.duplicates) stderr(`  - duplicate image model: ${id}`);
  for (const id of result.images.emptyIds) stderr(`  - empty image model ID: ${JSON.stringify(id)}`);
  for (const id of result.images.invalidOutputModality) {
    stderr(`  - image model does not advertise image output: ${id}`);
  }
  for (const entry of result.images.missingRequiredParameters) {
    stderr(`  - image model ${entry.id} lacks parameters: ${entry.missing.join(", ")}`);
  }
}

function runtimeErrorResult(message) {
  return {
    status: "error",
    reason: "runtime_error",
    message,
  };
}

export async function runCli(
  argv = process.argv.slice(2),
  {
    env = process.env,
    fetchImpl = globalThis.fetch,
    stdout = console.log,
    stderr = console.error,
    loadEnvironment = true,
    readCatalog = readLocalCatalog,
    fetchCatalogs = fetchOpenRouterCatalogs,
  } = {},
) {
  const flags = parseArgs(argv);

  if (flags.help) {
    stdout(helpText());
    return EXIT_CODES.PASS;
  }
  if (flags.version) {
    stdout(packageVersion());
    return EXIT_CODES.PASS;
  }
  if (flags.unknown.length > 0) {
    stderr(`verify-models: unknown argument(s): ${flags.unknown.join(", ")}. Run with --help.`);
    return EXIT_CODES.RUNTIME_ERROR;
  }

  if (loadEnvironment && env === process.env) {
    const isVercel = Boolean(env.VERCEL || env.VERCEL_ENV);
    const isProduction = env.NODE_ENV === "production" || isVercel;
    const silentLogger = { info: () => {}, error: () => {}, warn: () => {} };
    loadEnvConfig(ROOT, !isProduction, silentLogger);
  }

  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENROUTER_API_KEY is not set. Add it to .env.local or repository secrets.";
    if (flags.json) stdout(JSON.stringify(runtimeErrorResult(message)));
    else stderr(message);
    return EXIT_CODES.RUNTIME_ERROR;
  }

  try {
    const catalog = await readCatalog(catalogPathsFromEnv(env));
    const { textModels, imageModels } = await fetchCatalogs(apiKey, { fetchImpl });
    const result = evaluateCatalogs(catalog, textModels, imageModels);

    if (flags.json) stdout(JSON.stringify(result));
    else printHumanResult(result, stdout, stderr);

    return result.status === "pass" ? EXIT_CODES.PASS : EXIT_CODES.MISSING;
  } catch (error) {
    const message = error?.message || "verify-models: unexpected failure.";
    if (flags.json) stdout(JSON.stringify(runtimeErrorResult(message)));
    else stderr(`verify-models: ${message}`);
    if (env.VERIFY_MODELS_DEBUG) stderr(error?.stack ?? "");
    return EXIT_CODES.RUNTIME_ERROR;
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  runCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error?.message || "verify-models: unexpected failure.");
      if (process.env.VERIFY_MODELS_DEBUG) console.error(error?.stack ?? "");
      process.exitCode = EXIT_CODES.RUNTIME_ERROR;
    });
}
