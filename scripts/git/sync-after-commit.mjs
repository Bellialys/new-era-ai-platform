#!/usr/bin/env node
/**
 * Auto-sync: pushes local commits to upstream after every commit (or manually).
 *
 *   node scripts/git/sync-after-commit.mjs [--dry-run] [--hook] [--help]
 *
 * Environment variables:
 *   GIT_AUTO_SYNC_AFTER_COMMIT=0   Disable auto-push
 *   NO_GIT_AUTO_SYNC=1             Disable auto-push (legacy alias)
 *   CI                             Any truthy value disables auto-push
 *   GIT_AUTO_SYNC_DEBUG=1          Verbose debug output
 *
 * Exit codes:
 *   0  success or graceful skip (in --hook mode always 0)
 *   1  push failed or hard error (only outside --hook mode)
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const flags = { help: false, version: false, dryRun: false, hook: false, unknown: [] };
  for (const arg of argv) {
    switch (arg) {
      case "--help":    case "-h": flags.help    = true; break;
      case "--version": case "-v": flags.version = true; break;
      case "--dry-run":            flags.dryRun  = true; break;
      case "--hook":               flags.hook    = true; break;
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
Usage: node scripts/git/sync-after-commit.mjs [options]

Options:
  --dry-run      Show what would be pushed without actually pushing
  --hook         Run in git-hook mode (always exits 0 to not block commits)
  --help, -h     Show this help
  --version, -v  Show version

Environment variables:
  GIT_AUTO_SYNC_AFTER_COMMIT=0   Disable auto-push
  NO_GIT_AUTO_SYNC=1             Disable auto-push (legacy alias)
  CI                             Any truthy value disables auto-push
  GIT_AUTO_SYNC_DEBUG=1          Verbose debug output

Exit codes:
  0  success or graceful skip
  1  push failed (only outside --hook mode)
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
// Main
// ---------------------------------------------------------------------------
function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    showHelp();
    process.exit(0);
  }
  if (flags.version) {
    showVersion();
    process.exit(0);
  }

  const DRY_RUN   = flags.dryRun;
  const HOOK_MODE = flags.hook;
  const DEBUG     = Boolean(process.env.GIT_AUTO_SYNC_DEBUG);

  // Unknown flags: warn in manual mode, silently ignore in hook mode (safety-first).
  if (flags.unknown.length > 0 && !HOOK_MODE) {
    console.warn(`[auto-sync] WARN  unknown argument(s): ${flags.unknown.join(", ")} -- continuing`);
  }

  // -------------------------------------------------------------------------
  // Exit helper -- in --hook mode always exit 0 to not break git workflow
  // -------------------------------------------------------------------------
  function exitWith(code) {
    process.exit(HOOK_MODE ? 0 : code);
  }

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------
  function log(msg)  { console.log(`[auto-sync] ${msg}`); }
  function warn(msg) { console.warn(`[auto-sync] WARN  ${msg}`); }
  function dbg(msg)  { if (DEBUG) console.log(`[auto-sync] DEBUG ${msg}`); }

  // -------------------------------------------------------------------------
  // Skip / fail
  // -------------------------------------------------------------------------
  function skip(reason) { log(`skip: ${reason}`); exitWith(0); }
  function fail(reason) { warn(reason); exitWith(1); }

  // -------------------------------------------------------------------------
  // Git helper -- 30s timeout, no interactive credential prompts
  // -------------------------------------------------------------------------
  const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

  function git(args) {
    dbg(`git ${args.join(" ")}`);
    const result = spawnSync("git", args, {
      encoding: "utf8",
      stdio:    "pipe",
      env:      GIT_ENV,
      timeout:  30_000,
    });

    if (result.error) {
      const msg = result.signal === "SIGTERM"
        ? `git ${args[0]} timed out after 30s`
        : result.error.message;
      return { ok: false, stdout: "", stderr: msg, status: 1 };
    }

    return {
      ok:     result.status === 0,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      status: result.status ?? 1,
    };
  }

  // -------------------------------------------------------------------------
  // Environment kill-switches
  // -------------------------------------------------------------------------
  if (
    process.env.GIT_AUTO_SYNC_AFTER_COMMIT === "0" ||
    process.env.NO_GIT_AUTO_SYNC          === "1"  ||
    Boolean(process.env.CI)
  ) {
    skip("disabled by environment");
  }

  // -------------------------------------------------------------------------
  // Git checks
  // -------------------------------------------------------------------------
  const insideWorkTree = git(["rev-parse", "--is-inside-work-tree"]);
  if (!insideWorkTree.ok || insideWorkTree.stdout !== "true") {
    skip("not inside a Git work tree");
  }

  const rootRes = git(["rev-parse", "--show-toplevel"]);
  if (!rootRes.ok) fail("could not resolve repository root");
  process.chdir(rootRes.stdout);

  // symbolic-ref cleanly fails on detached HEAD; branch --show-current returns "".
  const branchRes = git(["symbolic-ref", "--short", "HEAD"]);
  if (!branchRes.ok || !branchRes.stdout) {
    skip("detached HEAD -- cannot push");
  }
  const branch = branchRes.stdout;

  const statusRes = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (!statusRes.ok) fail("could not inspect working tree status");
  if (statusRes.stdout.length > 0) skip("working tree has uncommitted changes");

  const upstreamRes = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  if (!upstreamRes.ok || !upstreamRes.stdout) {
    skip(`no upstream configured for ${branch}; run: git push -u origin ${branch}`);
  }
  const upstream   = upstreamRes.stdout;
  const remoteName = upstream.split("/")[0]; // "origin/main" -> "origin"

  const fetchRes = git(["fetch", "--quiet", "--prune", remoteName]);
  if (!fetchRes.ok) {
    if (HOOK_MODE) {
      // Network failure must not block the user's commit.
      warn(`fetch failed (${fetchRes.stderr || "network error"}); skipping push`);
      exitWith(0);
    }
    fail(`could not fetch ${remoteName}: ${fetchRes.stderr}`);
  }

  // HEAD is left of ..., @{u} is right:
  //   left  count = commits in HEAD not in @{u} = ahead
  //   right count = commits in @{u} not in HEAD = behind
  const countsRes = git(["rev-list", "--left-right", "--count", "HEAD...@{u}"]);
  if (!countsRes.ok) fail("could not compare local branch with upstream");

  const [aheadText, behindText] = countsRes.stdout.split(/\s+/);
  const ahead  = parseInt(aheadText,  10);
  const behind = parseInt(behindText, 10);

  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
    fail("could not parse branch sync state");
  }

  if (behind > 0) skip(`upstream has ${behind} new commit(s); run: git pull --rebase`);
  if (ahead  === 0) skip(`${branch} already matches ${upstream}`);

  // -------------------------------------------------------------------------
  // Push
  // -------------------------------------------------------------------------
  if (DRY_RUN) {
    log(`[dry-run] would push ${ahead} commit(s) from ${branch} to ${upstream}`);
    exitWith(0);
  }

  log(`pushing ${ahead} commit(s) from ${branch} to ${upstream}...`);
  const pushRes = git(["push", "--quiet"]);
  if (!pushRes.ok) {
    fail(`git push failed: ${pushRes.stderr || "run git push manually to inspect"}`);
  }

  log(`pushed ${ahead} commit(s) successfully`);
  exitWith(0);
}

main();
