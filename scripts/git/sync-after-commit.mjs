#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const hookMode = args.has("--hook");

function exitWith(code) {
  process.exit(hookMode ? 0 : code);
}

function log(message) {
  console.log(`[auto-sync] ${message}`);
}

function warn(message) {
  console.warn(`[auto-sync] ${message}`);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error) {
    return {
      ok: false,
      stdout: "",
      stderr: result.error.message,
      status: 1,
    };
  }

  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    status: result.status ?? 1,
  };
}

function skip(message) {
  log(`skip: ${message}`);
  exitWith(0);
}

function fail(message) {
  warn(message);
  exitWith(1);
}

if (
  process.env.GIT_AUTO_SYNC_AFTER_COMMIT === "0" ||
  process.env.NO_GIT_AUTO_SYNC === "1" ||
  process.env.CI === "true"
) {
  skip("disabled by environment");
}

const insideWorkTree = run("git", ["rev-parse", "--is-inside-work-tree"]);
if (!insideWorkTree.ok || insideWorkTree.stdout !== "true") {
  skip("not inside a Git work tree");
}

const root = run("git", ["rev-parse", "--show-toplevel"]);
if (!root.ok) {
  fail("could not resolve repository root");
}
process.chdir(root.stdout);

const branch = run("git", ["branch", "--show-current"]);
if (!branch.ok || branch.stdout.length === 0) {
  skip("detached HEAD has no branch to push");
}

const status = run("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
if (!status.ok) {
  fail("could not inspect working tree status");
}
if (status.stdout.length > 0) {
  skip("working tree has uncommitted changes");
}

const upstream = run("git", [
  "rev-parse",
  "--abbrev-ref",
  "--symbolic-full-name",
  "@{u}",
]);
if (!upstream.ok || upstream.stdout.length === 0) {
  skip(`no upstream configured for ${branch.stdout}; run git push -u origin ${branch.stdout}`);
}

const remoteName = upstream.stdout.split("/")[0];
const fetch = run("git", ["fetch", "--quiet", "--prune", remoteName]);
if (!fetch.ok) {
  fail(`could not fetch ${remoteName}; push was not attempted`);
}

const counts = run("git", ["rev-list", "--left-right", "--count", "HEAD...@{u}"]);
if (!counts.ok) {
  fail("could not compare local branch with upstream");
}

const [aheadText, behindText] = counts.stdout.split(/\s+/);
const ahead = Number.parseInt(aheadText, 10);
const behind = Number.parseInt(behindText, 10);

if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
  fail("could not parse branch sync state");
}

if (behind > 0) {
  skip(`upstream has ${behind} new commit(s); run git pull --rebase before pushing`);
}

if (ahead === 0) {
  skip(`${branch.stdout} already matches ${upstream.stdout}`);
}

if (dryRun) {
  log(`would push ${ahead} commit(s) from ${branch.stdout} to ${upstream.stdout}`);
  exitWith(0);
}

const push = run("git", ["push", "--quiet"]);
if (!push.ok) {
  fail(`git push failed for ${branch.stdout}; run git push manually to inspect details`);
}

log(`pushed ${ahead} commit(s) from ${branch.stdout} to ${upstream.stdout}`);
exitWith(0);
