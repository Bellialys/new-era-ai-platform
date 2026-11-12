#!/usr/bin/env node
/**
 * Manual, bounded OpenRouter inference smoke test for the curated free catalog.
 *
 * No user prompts, no persistence, no credential logging, and no paid model IDs.
 * Uses at most 8 requests, sequentially, with a pause to respect free quotas.
 * Failed requests count toward OpenRouter's daily free quota.
 * Usage: npm run models:smoke:live -- --limit=2
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelPath = join(root, "src", "lib", "server", "models.ts");
const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function extractFreeModels(source) {
  const ids = [...source.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
  const unique = [...new Set(ids)];
  if (ids.length === 0 || ids.length !== unique.length ||
      ids.some((id) => !id.endsWith(":free")) || ids.length > 8) {
    throw new Error("Catalog must contain 1-8 unique free model identifiers.");
  }
  return unique;
}

export function parseLimit(argv, max) {
  const flag = argv.find((arg) => arg.startsWith("--limit="));
  if (argv.some((arg) => !arg.startsWith("--limit="))) {
    throw new Error("Only --limit=N is supported.");
  }
  const n = flag ? Number(flag.slice("--limit=".length)) : max;
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error("Limit must be an integer from 1 to catalog size.");
  }
  return n;
}

export async function checkOneModel(modelId, apiKey, callFetch = fetch) {
  try {
    const response = await callFetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://new-era-ai-platform.vercel.app",
        "X-Title": "New Era AI Platform — manual smoke test",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Reply with one word: OK" }],
        max_tokens: 384,
        temperature: 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      // Do not log raw response bodies or potentially sensitive provider metadata.
      if (response.status === 429) return { status: "RATE_LIMIT" };
      if (response.status === 404) return { status: "NOT_FOUND" };
      if (response.status === 401 || response.status === 403) {
        return { status: "AUTH_ERROR" };
      }
      if (response.status === 402) return { status: "NO_CREDITS" };
      return { status: "HTTP_" + response.status };
    }
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    return { status: typeof content === "string" && content.trim() ? "OK" : "EMPTY_RESPONSE" };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    return { status: name === "TimeoutError" || name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR" };
  }
}

async function main() {
  loadEnvConfig(root);
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    console.error("Missing OPENROUTER_API_KEY in the environment. No requests were sent.");
    process.exitCode = 2;
    return;
  }
  const ids = extractFreeModels(readFileSync(modelPath, "utf8"));
  const limit = parseLimit(process.argv.slice(2), ids.length);
  let failures = 0;
  console.log("Testing " + limit + " FREE models (each call counts toward free quota).");
  for (const [index, id] of ids.slice(0, limit).entries()) {
    if (index > 0) await wait(3500);
    const result = await checkOneModel(id, key);
    if (result.status !== "OK") failures++;
    console.log((index + 1) + "/" + limit + " " + id + ": " + result.status);
  }
  console.log("Results: " + (limit - failures) + " responding, " + failures + " failed.");
  if (failures > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Never log raw objects from HTTP/credentials.
    console.error(error instanceof Error ? error.message : "Smoke test failed.");
    process.exitCode = 2;
  });
}
