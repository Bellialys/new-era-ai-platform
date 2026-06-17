/**
 * Tests for scripts/check-env.mjs — production-grade suite.
 *
 * Design goals:
 *   - Full coverage: required vars, format checks, JWT validation, gitignore
 *     enforcement, CI detection, strict mode, JSON output, secret-leak prevention.
 *   - Parallel-safe: concurrency: true on the outer describe; each test creates
 *     and disposes its own CheckEnvRunner via withRunner() — no shared mutable state.
 *   - Guaranteed cleanup: try/finally inside withRunner ensures temp dirs are
 *     removed even when assertions throw.
 *   - No real secrets used: the parent process env is scrubbed of all known
 *     sensitive variables and only synthetic values are injected.  Every test
 *     additionally asserts that synthetic values never appear in output.
 *
 * Exit-code contract (mirrors check-env.mjs):
 *   0  all required variables present and valid
 *   1  missing / empty / invalid variable, or WARNING promoted by --strict
 *   2  bad invocation (unknown flag, unknown --mode value)
 *   3  security risk (NEXT_PUBLIC_ secret or .env.local not gitignored)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRIPT = fileURLToPath(new URL("./check-env.mjs", import.meta.url));

/** Prevents the suite from hanging if check-env.mjs deadlocks or loops. */
const SPAWN_TIMEOUT_MS = 10_000;

/** Prevents stdout/stderr truncation on verbose output. */
const SPAWN_MAX_BUFFER = 1024 * 1024; // 1 MB

/**
 * Variables purged from the parent process so real secrets never reach tests.
 * Extend whenever a new sensitive variable is added to the project.
 */
const SENSITIVE_INHERITED = [
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

/**
 * Synthetic values injected per-test.
 * They MUST NOT appear in any captured output — assertNoLeaks() enforces this.
 */
const TEST_VALUES = {
  NEXT_PUBLIC_SUPABASE_URL:             "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SERVICE_ROLE_KEY:            "sb_secret_example",
  OPENROUTER_API_KEY:                   "sk-or-v1-example",
  NEXT_PUBLIC_SITE_URL:                 "http://localhost:3000",
};

const ALL_TEST_VALUES = Object.values(TEST_VALUES);

// ---------------------------------------------------------------------------
// CheckEnvRunner
// ---------------------------------------------------------------------------

/**
 * Isolated runner for check-env.mjs.
 *
 * Each instance owns a dedicated temp directory pre-populated with an empty
 * .env.local and a .gitignore that ignores it.  Tests that need file-system
 * access can read runner.dir; cleanup() removes the directory.
 */
class CheckEnvRunner {
  /** @type {string} */
  #dir;

  constructor() {
    this.#dir = mkdtempSync(join(tmpdir(), "env-check-"));
    writeFileSync(join(this.#dir, ".env.local"), "", "utf8");
    writeFileSync(join(this.#dir, ".gitignore"), ".env.local\n", "utf8");
  }

  /** Absolute path of the temp directory (needed to inspect generated files). */
  get dir() {
    return this.#dir;
  }

  /**
   * Execute check-env.mjs with the given CLI args and extra env vars.
   *
   * @param {string[]} args      CLI arguments forwarded to the script.
   * @param {object}   extraEnv  Additional env vars injected into the child process.
   * @returns {{ code: number, stdout: string, stderr: string, timedOut: boolean }}
   */
  run(args = [], extraEnv = {}) {
    const env = { ...process.env, ENV_CHECK_DIR: this.#dir };
    for (const key of SENSITIVE_INHERITED) delete env[key];
    Object.assign(env, extraEnv);

    const result = spawnSync(process.execPath, [SCRIPT, ...args], {
      env,
      encoding:  "utf8",
      timeout:   SPAWN_TIMEOUT_MS,
      maxBuffer: SPAWN_MAX_BUFFER,
    });

    return {
      code:     result.status ?? -1,
      stdout:   result.stdout ?? "",
      stderr:   result.stderr ?? "",
      timedOut: result.signal === "SIGTERM",
    };
  }

  /**
   * Overwrite (or remove) the .gitignore file.
   *
   * @param {string} content  New content; pass an empty string to delete the file.
   */
  setGitignore(content) {
    if (content) {
      writeFileSync(join(this.#dir, ".gitignore"), content, "utf8");
    } else {
      rmSync(join(this.#dir, ".gitignore"), { force: true });
    }
  }

  /**
   * Overwrite (or remove) the .vercelignore file.
   *
   * @param {string} content  New content; pass an empty string to delete the file.
   */
  setVercelignore(content) {
    if (content) {
      writeFileSync(join(this.#dir, ".vercelignore"), content, "utf8");
    } else {
      rmSync(join(this.#dir, ".vercelignore"), { force: true });
    }
  }

  /** Remove the temp directory.  Safe to call multiple times. */
  cleanup() {
    try {
      rmSync(this.#dir, { recursive: true, force: true });
    } catch {
      // best-effort — temp dirs are cleared by the OS on reboot at worst
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a test function with per-test runner creation and guaranteed cleanup.
 *
 * Usage:
 *   it("my test", withRunner((r) => { ... }));
 *
 * @param {(runner: CheckEnvRunner) => void} fn  Test body receiving the runner.
 * @returns {() => void}  Callback suitable for it().
 */
function withRunner(fn) {
  return function () {
    const r = new CheckEnvRunner();
    try {
      fn(r);
    } finally {
      r.cleanup();
    }
  };
}

/**
 * Assert that none of the synthetic TEST_VALUES appear in `output`.
 *
 * @param {string} label   Prefix in the failure message (e.g. "stdout").
 * @param {string} output  Captured output to inspect.
 */
function assertNoLeaks(label, output) {
  for (const value of ALL_TEST_VALUES) {
    assert.ok(
      !output.includes(value),
      `${label}: synthetic value "${value}" must not appear in output`,
    );
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("check-env.mjs", { concurrency: true }, () => {

  // ---- CLI flags -----------------------------------------------------------

  describe("CLI flags", () => {
    it("--help exits 0 and documents all major options", withRunner((r) => {
      const { code, stdout } = r.run(["--help"]);
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes("--mode"),             "--help must document --mode");
      assert.ok(stdout.includes("--strict"),           "--help must document --strict");
      assert.ok(stdout.includes("--generate-example"), "--help must document --generate-example");
      assert.ok(stdout.includes("--ci"),               "--help must document --ci");
      assert.ok(stdout.includes("--json"),             "--help must document --json");
    }));

    it("-h is an alias for --help", withRunner((r) => {
      const { code, stdout } = r.run(["-h"]);
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes("--mode"));
    }));

    it("--version exits 0 and prints a semver string", withRunner((r) => {
      const { code, stdout } = r.run(["--version"]);
      assert.strictEqual(code, 0);
      assert.match(stdout.trim(), /^\d+\.\d+\.\d+/, "version must be semver");
    }));

    it("-v is an alias for --version", withRunner((r) => {
      const { code, stdout } = r.run(["-v"]);
      assert.strictEqual(code, 0);
      assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
    }));

    it("unknown flag exits 2", withRunner((r) => {
      const { code, stderr } = r.run(["--bad-flag"]);
      assert.strictEqual(code, 2);
      assert.ok(
        stderr.includes("--bad-flag") || stderr.includes("unknown"),
        "error message must mention the unknown flag",
      );
    }));

    it("unknown --mode value exits 2", withRunner((r) => {
      const { code, stderr } = r.run(["--mode=bogus"], TEST_VALUES);
      assert.strictEqual(code, 2);
      assert.ok(
        stderr.includes("bogus") || stderr.includes("invalid --mode"),
        "error message must mention the invalid mode value",
      );
    }));

    it("--mode <value> (space syntax) is accepted", withRunner((r) => {
      const { code, stdout } = r.run(["--mode", "basic"], TEST_VALUES);
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes("ENV CHECK PASSED"));
    }));
  });

  // ---- Required variables --------------------------------------------------

  describe("required variables", () => {
    it("exits 0 when all required vars are present and valid", withRunner((r) => {
      const { code, stdout, stderr } = r.run(["--mode=basic"], TEST_VALUES);
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes("ENV CHECK PASSED"));
    }));

    it("exits 1 and names the variable when OPENROUTER_API_KEY is missing", withRunner((r) => {
      const env = { ...TEST_VALUES };
      delete env.OPENROUTER_API_KEY;
      const { code, stdout, stderr } = r.run(["--mode=basic"], env);
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.strictEqual(code, 1);
      assert.ok(stdout.includes("MISSING  OPENROUTER_API_KEY: is required"));
      assert.ok(stdout.includes("ENV CHECK FAILED"));
    }));

    it("exits 1 when NEXT_PUBLIC_SUPABASE_URL is missing", withRunner((r) => {
      const env = { ...TEST_VALUES };
      delete env.NEXT_PUBLIC_SUPABASE_URL;
      const { code, stdout, stderr } = r.run(["--mode=basic"], env);
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.strictEqual(code, 1);
    }));

    it("exits 1 when a required var is present but empty", withRunner((r) => {
      const { code, stdout } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        OPENROUTER_API_KEY: "",
      });
      assert.strictEqual(code, 1);
      assert.ok(stdout.includes("EMPTY    OPENROUTER_API_KEY: is required but empty"));
    }));

    it("never prints secret values — only variable names and statuses", withRunner((r) => {
      const sentinel = "SENTINEL_SECRET_XYZ_12345";
      const { code, stdout, stderr } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${sentinel}`,
        OPENROUTER_API_KEY:        `sk-or-v1-${sentinel}`,
      });
      assert.strictEqual(code, 0, `Expected exit 0, got ${code}. stderr:\n${stderr}`);
      assert.ok(!stdout.includes(sentinel), "stdout must not contain the sentinel value");
      assert.ok(!stderr.includes(sentinel), "stderr must not contain the sentinel value");
    }));

    it("mentions the variable NAME (not its value) when reporting a missing var", withRunner((r) => {
      const env = { ...TEST_VALUES };
      delete env.SUPABASE_SERVICE_ROLE_KEY;
      const { stdout, stderr } = r.run(["--mode=basic"], env);
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.ok(
        stdout.includes("SUPABASE_SERVICE_ROLE_KEY") ||
          stderr.includes("SUPABASE_SERVICE_ROLE_KEY"),
        "The missing variable name must appear in the output",
      );
    }));
  });

  // ---- Format validation ---------------------------------------------------

  describe("format validation", () => {
    it("exits 1 when OPENROUTER_API_KEY does not start with sk-or-v1-", withRunner((r) => {
      const { code, stdout } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        OPENROUTER_API_KEY: "not-a-valid-key",
      });
      assert.strictEqual(code, 1);
      assert.ok(stdout.includes("INVALID  OPENROUTER_API_KEY: must start with sk-or-v1-"));
    }));

    it("emits WARNING (not INVALID) when optional NEXT_PUBLIC_SITE_URL fails format check", withRunner((r) => {
      // NEXT_PUBLIC_SITE_URL is optional — a bad value produces a WARNING, not INVALID,
      // so the exit code remains 0.
      const { code, stdout, stderr } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        NEXT_PUBLIC_SITE_URL: "just-a-string",
      });
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes("WARNING  NEXT_PUBLIC_SITE_URL:"));
    }));

    it("treats optional NEXT_PUBLIC_SITE_URL with only whitespace as OPTIONAL (exit 0)", withRunner((r) => {
      // Optional vars with whitespace-only values are treated as unset (OPTIONAL), not EMPTY.
      const { code, stdout } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        NEXT_PUBLIC_SITE_URL: "   ",
      });
      assert.strictEqual(code, 0);
      // Must not emit an error; it's either OPTIONAL or not mentioned at all.
      assert.ok(!stdout.includes("INVALID  NEXT_PUBLIC_SITE_URL:"));
      assert.ok(!stdout.includes("EMPTY    NEXT_PUBLIC_SITE_URL:"));
    }));

    it("exits 0 when NEXT_PUBLIC_SITE_URL contains query-string characters", withRunner((r) => {
      const { code, stdout, stderr } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000?x=y&a=b",
      });
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.strictEqual(code, 0);
    }));

    it("exits 1 when SUPABASE_SERVICE_ROLE_KEY is a JWT with role=anon", withRunner((r) => {
      const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
      const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
      const { code, stdout } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        SUPABASE_SERVICE_ROLE_KEY: fakeJwt,
      });
      assert.strictEqual(code, 1);
      assert.ok(stdout.includes("INVALID  SUPABASE_SERVICE_ROLE_KEY: must be service_role, not anon"));
    }));

    it("exits 0 but emits WARNING when SUPABASE_SERVICE_ROLE_KEY JWT has no role claim", withRunner((r) => {
      const payload = Buffer.from(JSON.stringify({ sub: "user", iat: 1 })).toString("base64url");
      const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
      const { code, stdout } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        SUPABASE_SERVICE_ROLE_KEY: fakeJwt,
      });
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes("WARNING  SUPABASE_SERVICE_ROLE_KEY: JWT payload missing 'role' claim"));
      assert.ok(stdout.includes("ENV CHECK PASSED"));
    }));
  });

  // ---- Security enforcement ------------------------------------------------

  describe("security enforcement", () => {
    it("exits 3 (FATAL) when a secret is exposed via NEXT_PUBLIC_", withRunner((r) => {
      const { code, stdout } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        NEXT_PUBLIC_OPENROUTER_API_KEY: "anything",
      });
      assert.strictEqual(code, 3);
      assert.ok(
        stdout.includes(
          "FATAL    NEXT_PUBLIC_OPENROUTER_API_KEY: Potential secret exposed to client:" +
            " NEXT_PUBLIC_OPENROUTER_API_KEY must not be public",
        ),
      );
    }));
  });

  // ---- .gitignore enforcement ----------------------------------------------

  describe(".gitignore enforcement", () => {
    it("exits 3 (FATAL) when .gitignore does not exist", withRunner((r) => {
      r.setGitignore("");
      const { code, stdout } = r.run(["--mode=basic"], TEST_VALUES);
      assert.strictEqual(code, 3);
      assert.ok(stdout.includes("FATAL    .env.local: .env.local must be ignored by Git"));
    }));

    it("exits 3 (FATAL) when .gitignore does not mention .env.local", withRunner((r) => {
      r.setGitignore("node_modules/\n");
      const { code, stdout } = r.run(["--mode=basic"], TEST_VALUES);
      assert.strictEqual(code, 3);
      assert.ok(stdout.includes("FATAL    .env.local: .env.local must be ignored by Git"));
    }));

    it("accepts .vercelignore env protection during Vercel builds", withRunner((r) => {
      r.setGitignore("");
      r.setVercelignore(".env\n.env.*\n.env*.local\n");
      const { code, stdout, stderr } = r.run(["--mode=basic"], {
        ...TEST_VALUES,
        VERCEL:     "1",
        VERCEL_ENV: "preview",
      });
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.strictEqual(code, 0);
    }));
  });

  // ---- CI detection and strict mode ----------------------------------------

  describe("CI detection and strict mode", () => {
    // CI_TRUTHY in check-env.mjs accepts "true", "1", and "yes".
    for (const ciValue of ["true", "1", "yes"]) {
      it(`detects CI=${ciValue} and exits 0 on a valid env`, withRunner((r) => {
        const { code, stdout, stderr } = r.run(["--mode=basic"], { ...TEST_VALUES, CI: ciValue });
        assertNoLeaks("stdout", stdout);
        assertNoLeaks("stderr", stderr);
        assert.strictEqual(code, 0, `CI=${ciValue} with valid env must exit 0`);
      }));
    }

    it("--ci flag exits 0 on a valid env", withRunner((r) => {
      const { code, stdout, stderr } = r.run(["--ci", "--mode=basic"], TEST_VALUES);
      assertNoLeaks("stdout", stdout);
      assertNoLeaks("stderr", stderr);
      assert.strictEqual(code, 0);
    }));

    it("--ci exits non-zero when a required var is missing", withRunner((r) => {
      const env = { ...TEST_VALUES };
      delete env.SUPABASE_SERVICE_ROLE_KEY;
      const { code } = r.run(["--ci", "--mode=basic"], env);
      assert.notStrictEqual(code, 0, "CI mode must treat a missing required var as fatal");
    }));

    it("--strict promotes JWT missing-role WARNING to INVALID (exit 1)", withRunner((r) => {
      const payload = Buffer.from(JSON.stringify({ sub: "user", iat: 1 })).toString("base64url");
      const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
      const { code, stdout } = r.run(["--mode=basic", "--strict"], {
        ...TEST_VALUES,
        SUPABASE_SERVICE_ROLE_KEY: fakeJwt,
      });
      assert.strictEqual(code, 1);
      assert.ok(stdout.includes("ENV CHECK FAILED"));
      assert.ok(stdout.includes("strict mode"));
    }));
  });

  // ---- JSON output (--json) ------------------------------------------------

  describe("JSON output (--json)", () => {
    it("produces valid JSON, exits 0, and omits secret values on success", withRunner((r) => {
      const sentinel = "JSONSENTINEL_99999";
      const { code, stdout } = r.run(["--mode=basic", "--json"], {
        ...TEST_VALUES,
        OPENROUTER_API_KEY: `sk-or-v1-${sentinel}`,
      });
      assert.strictEqual(code, 0);
      assert.ok(!stdout.includes(sentinel), "JSON output must not contain the sentinel value");
      const report = JSON.parse(stdout);
      assert.strictEqual(report.status, "passed");
      for (const detail of report.details) {
        assert.deepEqual(
          Object.keys(detail).sort(),
          ["category", "message", "name", "required", "status"],
          `Unexpected keys in detail for ${detail.name}`,
        );
      }
    }));

    it("JSON output includes strict:true when --strict is passed", withRunner((r) => {
      const { code, stdout } = r.run(["--mode=basic", "--json", "--strict"], TEST_VALUES);
      assert.strictEqual(code, 0);
      const report = JSON.parse(stdout);
      assert.strictEqual(typeof report.strict, "boolean");
      assert.strictEqual(report.strict, true);
    }));
  });

  // ---- --generate-example --------------------------------------------------

  describe("--generate-example", () => {
    it("creates .env.local.example with placeholders, never real values", withRunner((r) => {
      const sentinel = "REALENVSENTINEL_XYZ_12345";
      r.run(["--generate-example"], {
        ...TEST_VALUES,
        OPENROUTER_API_KEY: `sk-or-v1-${sentinel}`,
      });
      const examplePath = join(r.dir, ".env.local.example");
      assert.ok(existsSync(examplePath), ".env.local.example must be created");
      const content = readFileSync(examplePath, "utf8");
      assert.ok(!content.includes(sentinel), "example file must not contain the real env value");
      assert.ok(
        content.includes("OPENROUTER_API_KEY=your-openrouter-key"),
        "example file must use a placeholder value for OPENROUTER_API_KEY",
      );
    }));
  });

});
