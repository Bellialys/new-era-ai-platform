import assert from "node:assert/strict";
import test from "node:test";

import {
  getComparisonBase,
  isSafeBuildSkipPath,
  shouldSkipVercelBuild,
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
    assert.equal(isSafeBuildSkipPath(filePath), true, filePath);
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
    "scripts/vercel-ignore-build.mjs",
    "vercel.json",
    ".project/task.schema.json",
  ];

  for (const filePath of rejected) {
    assert.equal(isSafeBuildSkipPath(filePath), false, filePath);
  }
});

test("uses the explicit previous deployment SHA when Vercel provides one", () => {
  assert.equal(
    getComparisonBase({ previousSha: "abc123" }),
    "abc123",
  );
});

test("falls back to the checked-out commit parent when previous SHA is absent", () => {
  assert.equal(
    getComparisonBase({ previousSha: "" }),
    "HEAD^1",
  );
});

test("skips when every changed path is explicitly safe", () => {
  assert.equal(
    shouldSkipVercelBuild({
      changedPaths: [
        "PROJECT-CONTEXT.md",
        "docs/infra/aws-kms-vercel-oidc.md",
        ".project/state.json",
      ],
    }),
    true,
  );
});

test("builds when a diff mixes safe and runtime-impacting paths", () => {
  assert.equal(
    shouldSkipVercelBuild({
      changedPaths: ["README.md", "src/app/page.tsx"],
    }),
    false,
  );
});

test("fails closed for an empty diff", () => {
  assert.equal(
    shouldSkipVercelBuild({ changedPaths: [] }),
    false,
  );
});
