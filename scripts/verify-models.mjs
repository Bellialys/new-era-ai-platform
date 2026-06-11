#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import ts from "typescript";

const { loadEnvConfig } = nextEnv;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS_FILE = join(ROOT, "src", "lib", "server", "models.ts");
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

loadEnvConfig(ROOT, true, { info: () => {}, error: () => {} });

function collectModelIdsFromNode(node, ids) {
  if (
    ts.isPropertyAssignment(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "id" &&
    ts.isStringLiteral(node.initializer)
  ) {
    ids.push(node.initializer.text);
    return;
  }

  ts.forEachChild(node, (child) => collectModelIdsFromNode(child, ids));
}

async function readLocalModelIds() {
  const sourceText = await readFile(MODELS_FILE, "utf8");
  const sourceFile = ts.createSourceFile(MODELS_FILE, sourceText, ts.ScriptTarget.Latest, true);
  const ids = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "ALLOWED_MODELS") continue;
      if (!declaration.initializer) continue;
      collectModelIdsFromNode(declaration.initializer, ids);
    }
  }

  return [...new Set(ids)].sort();
}

async function fetchOpenRouterModelIds(apiKey) {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter models request failed with HTTP ${response.status}.`);
  }

  const body = await response.json();
  const models = Array.isArray(body?.data) ? body.data : [];
  return new Set(models.map((model) => model?.id).filter((id) => typeof id === "string"));
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.error("OPENROUTER_API_KEY is not set. Add it to .env.local or the environment to run models:verify.");
    return 2;
  }

  const localIds = await readLocalModelIds();
  if (localIds.length === 0) {
    console.error("No local model ids were found in src/lib/server/models.ts.");
    return 1;
  }

  const liveIds = await fetchOpenRouterModelIds(apiKey);
  const missing = localIds.filter((id) => !liveIds.has(id));

  if (missing.length > 0) {
    console.error("OpenRouter model verification failed. Missing local model_key values:");
    for (const id of missing) console.error(`  - ${id}`);
    return 1;
  }

  console.log(`OpenRouter model verification passed (${localIds.length} local model ids).`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error?.message || "OpenRouter model verification failed.");
    process.exitCode = 2;
  });
