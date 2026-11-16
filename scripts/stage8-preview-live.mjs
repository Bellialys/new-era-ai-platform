import { spawnSync } from "node:child_process";

const expectedBranch = "test/stage8-catalog-preview-20261116";
if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== expectedBranch) {
  throw new Error("This validation only runs on the dedicated Vercel Preview branch.");
}
if (!process.env.OPENROUTER_API_KEY?.trim()) {
  throw new Error("Preview OpenRouter credential is missing.");
}

const result = spawnSync(process.execPath, [
  "node_modules/vitest/vitest.mjs", "run", "src/lib/server/stage8-preview-check.test.ts",
], {
  stdio: "inherit",
  timeout: 120_000,
  env: {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "test",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
});
if (result.status !== 0) throw new Error("Stage 8 Preview verification failed.");
