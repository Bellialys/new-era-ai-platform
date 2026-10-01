import assert from "node:assert/strict";
import test from "node:test";

import {
  getComparisonBase,
  isSafePreviewOnlyPath,
  shouldSkipVercelPreviewBuild,
} from "./vercel-ignore-build.mjs";

test("allows only explicit docs and project-state paths", () => {
  const allowed = [
    "docs/infra/aws-kms-vercel-oidc.md",
    "archive/old-plan.md",
    "14-roadmap.md",
    "README.md",
    "SECURITY.md",
    "AGENTS.md",
    "CLAUDE.md",
    "PROJECT-CONTEXT.md",
    ".project/state.json",
    ".project/tasks/V201-16.json",
  ];

  for (const filePath of allowed) {
    assert.equal(isSafePreviewOnlyPath(filePath), true, filePath);
  }
});

test("rejects runtime, dependency, migration, infrastructure, env, CI and build-script paths", () => {
  const rejected = [
    "src/app/page.tsx",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "env-check.config.json",
    ".env.example",
    "supabase/migrations/20261001000000_example.sql",
    "infra/aws-kms-vercel-oidc.yaml",
    ".github/workflows/ci.yml",
    "scripts/check-env.mjs",
    "vercel.json",
    ".project/task.schema.json",
  ];

  for (const filePath of rejected) {
    assert.equal(isSafePreviewOnlyPath(filePath), false, filePath);
  }
});

test("uses the explicit previous deployment SHA when Vercel provides one", () => {
  assert.equal(
    getComparisonBase({
      vercelEnv: "preview",
      previousSha: "abc123",
    }),
    "abc123",
  );
});

test("uses HEAD^1 for the first Preview deployment when previous SHA is absent", () => {
  assert.equal(
    getComparisonBase({
      vercelEnv: "preview",
      previousSha: "",
    }),
    "HEAD^1",
  );
});

test("does not invent a fallback comparison base for production", () => {
  assert.equal(
    getComparisonBase({
      vercelEnv: "production",
      previousSha: "",
    }),
    null,
  );
});

test("skips a preview build when every changed path is explicitly safe", () => {
  assert.equal(
    shouldSkipVercelPreviewBuild({
      vercelEnv: "preview",
      changedPaths: [
        "PROJECT-CONTEXT.md",
        "docs/infra/aws-kms-vercel-oidc.md",
        ".project/state.json",
      ],
    }),
    true,
  );
});

test("builds when a preview diff mixes safe and runtime-impacting paths", () => {
  assert.equal(
    shouldSkipVercelPreviewBuild({
      vercelEnv: "preview",
      changedPaths: ["README.md", "src/app/page.tsx"],
    }),
    false,
  );
});

test("always builds production and fails closed for an empty diff", () => {
  assert.equal(
    shouldSkipVercelPreviewBuild({
      vercelEnv: "production",
      changedPaths: ["README.md"],
    }),
    false,
  );
  assert.equal(
    shouldSkipVercelPreviewBuild({ vercelEnv: "preview", changedPaths: [] }),
    false,
  );
});
