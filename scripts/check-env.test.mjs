/**
 * Tests for scripts/check-env.mjs.
 *
 * Isolation: every run uses ENV_CHECK_DIR pointing at a fresh temp dir with an
 * empty .env.local and a .gitignore that ignores it. The real project .env.local
 * is never loaded, so no real secrets enter these tests. Variable values are
 * passed via the child process env, and we assert sentinel values never appear
 * in the output.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./check-env.mjs", import.meta.url));

// Names we scrub from the inherited env so nothing real leaks into a test run.
const SENSITIVE = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
  "DATABASE_URL",
  "SUPABASE_ACCESS_TOKEN",
  "CI",
  "VERCEL",
  "VERCEL_ENV",
  "NODE_ENV",
];

function runChecker(args, caseEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), "env-check-"));
  // Empty .env.local so the "not found" warning does not fire; no secrets written.
  writeFileSync(join(dir, ".env.local"), "", "utf8");
  writeFileSync(join(dir, ".gitignore"), ".env.local\n", "utf8");

  const env = { ...process.env, ENV_CHECK_DIR: dir };
  for (const key of SENSITIVE) delete env[key];
  Object.assign(env, caseEnv);

  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    env,
    encoding: "utf8",
  });

  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }

  return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

// A complete, valid basic env (no real secrets; safe synthetic values).
const VALID_BASIC = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_example",
  OPENROUTER_API_KEY: "sk-or-v1-example",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

test("does not print secret values", () => {
  const sentinel = "SENTINELSECRETVALUE";
  const { stdout, code } = runChecker(["--mode=basic"], {
    ...VALID_BASIC,
    SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${sentinel}`,
    OPENROUTER_API_KEY: `sk-or-v1-${sentinel}`,
  });
  assert.equal(code, 0, "valid basic env should pass");
  assert.ok(!stdout.includes(sentinel), "output must not contain secret value");
  assert.ok(stdout.includes("ENV CHECK PASSED"));
});

test("missing required variable fails", () => {
  const { stdout, code } = runChecker(["--mode=basic"], {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    // others intentionally omitted
  });
  assert.equal(code, 1);
  assert.ok(stdout.includes("MISSING: OPENROUTER_API_KEY is required"));
  assert.ok(stdout.includes("ENV CHECK FAILED"));
});

test("empty required variable fails", () => {
  const { stdout, code } = runChecker(["--mode=basic"], {
    ...VALID_BASIC,
    OPENROUTER_API_KEY: "",
  });
  assert.equal(code, 1);
  assert.ok(stdout.includes("EMPTY: OPENROUTER_API_KEY"));
});

test("invalid OPENROUTER_API_KEY fails", () => {
  const { stdout, code } = runChecker(["--mode=basic"], {
    ...VALID_BASIC,
    OPENROUTER_API_KEY: "not-a-valid-key",
  });
  assert.equal(code, 1);
  assert.ok(stdout.includes("INVALID: OPENROUTER_API_KEY must start with sk-or-v1-"));
});

test("secret leaked via NEXT_PUBLIC_ is FATAL (exit 3)", () => {
  const { stdout, code } = runChecker(["--mode=basic"], {
    ...VALID_BASIC,
    NEXT_PUBLIC_OPENROUTER_API_KEY: "anything",
  });
  assert.equal(code, 3);
  assert.ok(
    stdout.includes("FATAL: Potential secret exposed to client: NEXT_PUBLIC_OPENROUTER_API_KEY must not be public")
  );
});

test("service_role JWT with role=anon is INVALID", () => {
  // base64url payload {"role":"anon"} — header is irrelevant, signature ignored.
  const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
  const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
  const { stdout, code } = runChecker(["--mode=basic"], {
    ...VALID_BASIC,
    SUPABASE_SERVICE_ROLE_KEY: fakeJwt,
  });
  assert.equal(code, 1);
  assert.ok(stdout.includes("INVALID: SUPABASE_SERVICE_ROLE_KEY must be service_role, not anon"));
});

test("JSON mode contains no values", () => {
  const sentinel = "JSONSENTINEL";
  const { stdout, code } = runChecker(["--mode=basic", "--json"], {
    ...VALID_BASIC,
    OPENROUTER_API_KEY: `sk-or-v1-${sentinel}`,
  });
  assert.equal(code, 0);
  assert.ok(!stdout.includes(sentinel), "JSON must not contain secret value");
  const report = JSON.parse(stdout);
  assert.equal(report.status, "passed");
  for (const detail of report.details) {
    assert.deepEqual(
      Object.keys(detail).sort(),
      ["category", "message", "name", "required", "status"]
    );
  }
});

test("--generate-example does not use real environment values", () => {
  const sentinel = "REALENVSENTINEL";
  const dir = mkdtempSync(join(tmpdir(), "env-check-"));
  writeFileSync(join(dir, ".env.local"), "", "utf8");
  writeFileSync(join(dir, ".gitignore"), ".env.local\n", "utf8");

  const env = { ...process.env, ENV_CHECK_DIR: dir };
  for (const key of SENSITIVE) delete env[key];
  env.OPENROUTER_API_KEY = `sk-or-v1-${sentinel}`;

  const result = spawnSync(process.execPath, [SCRIPT, "--generate-example"], { env, encoding: "utf8" });
  assert.equal(result.status, 0);

  const examplePath = join(dir, ".env.local.example");
  assert.ok(existsSync(examplePath), ".env.local.example should be created");
  const content = readFileSync(examplePath, "utf8");
  assert.ok(!content.includes(sentinel), "example must not contain real env values");
  assert.ok(content.includes("OPENROUTER_API_KEY=your-openrouter-key"), "example uses placeholder");

  rmSync(dir, { recursive: true, force: true });
});
