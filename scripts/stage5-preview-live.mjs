import { spawnSync } from "node:child_process";
import { isEligibleFreeTextModel, probeFreeModel } from "../src/lib/server/model-health-sync.ts";

const previewBranch = "test/stage5-model-health-preview-20261113";
if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== previewBranch) {
  throw new Error("Stage 5 validation is scoped to the dedicated Vercel Preview branch.");
}

const testRun = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "src/lib/server/model-health-preview.test.ts"],
  {
    stdio: "inherit",
    timeout: 45000,
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" },
  },
);
if (testRun.status !== 0) {
  throw new Error("Stage 5 isolated lifecycle tests failed.");
}
console.log("[stage5] isolated_lifecycle=pass");

const modelIds = [
  "cohere/north-mini-code:free",
  "dots-studio/dots-3-note-preview:free",
  "nvidia/nemotron-3.5-lightning:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "recursive/flint-v1.0:free",
  "liquid/lfm-3-1.7b:free",
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const usesProductionSupabase = supabaseUrl
  ? new URL(supabaseUrl).hostname === "jbeecpbcsnowcaygteoj.supabase.co"
  : null;
console.log("[stage5] " + JSON.stringify({ usesProductionSupabase }));

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) {
  console.log("[stage5] live=blocked missing_preview_key");
  process.exit(1);
}

let catalogResponse;
try {
  catalogResponse = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: "Bearer " + key },
    redirect: "error",
    signal: AbortSignal.timeout(9000),
  });
} catch {
  throw new Error("OpenRouter catalog request failed.");
}
if (!catalogResponse.ok) {
  throw new Error("OpenRouter catalog HTTP " + catalogResponse.status);
}
const catalog = (await catalogResponse.json().catch(() => null))?.data;
if (!Array.isArray(catalog)) throw new Error("OpenRouter catalog format was invalid.");
const eligible = new Set(catalog.filter((model) => isEligibleFreeTextModel(model)).map(({ id }) => id));

let attempted = 0;
let succeeded = 0;
for (const model of modelIds) {
  if (!eligible.has(model)) {
    console.log("[stage5] " + JSON.stringify({ model, status: "NOT_ELIGIBLE", http: null, ms: null }));
    continue;
  }

  // One call per eligible model. Keep below the documented free per-minute limit.
  if (attempted) await new Promise((resolve) => setTimeout(resolve, 3500));
  attempted++;
  let http = null;
  const started = performance.now();
  const status = await probeFreeModel(model, key, async (url, init) => {
    const response = await fetch(url, { ...init, redirect: "error" });
    http = response.status;
    return response;
  });
  if (status === "OK") succeeded++;
  console.log("[stage5] " + JSON.stringify({ model, status, http, ms: Math.round(performance.now() - started) }));
  if (status === "AUTH_ERROR" || status === "NO_CREDITS") break;
}

console.log("[stage5] " + JSON.stringify({ attempted, succeeded, catalogEligible: eligible.size }));
if (!succeeded) process.exitCode = 1;
