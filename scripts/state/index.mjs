#!/usr/bin/env node
/**
 * Project state CLI. Prefer these commands over hand-editing the JSON.
 *
 *   node scripts/state/index.mjs [context|check|task|archive|version] [options]
 *   node scripts/state/index.mjs --help | --version
 *
 * Environment variables:
 *   STATE_DEBUG=1   Print stack traces on unexpected errors
 *
 * Exit codes:
 *   0  success
 *   1  validation error or bad usage
 *   2  runtime / unexpected error
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import {
  loadState, saveState, loadTask, listTaskFiles,
  writeJson, readJson, abs, HISTORY_FILE,
  validateProjectState, validateTaskRules, nowIso,
} from "../sync/utils.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EXIT_CODES = {
  SUCCESS:          0,
  VALIDATION_ERROR: 1,
  RUNTIME_ERROR:    2,
};

const TASK_STATUSES   = ["planned", "in_progress", "verify", "done", "blocked", "archived"];
const ACTIVE_STATUSES = new Set(["in_progress", "verify", "blocked"]);
const SEMVER          = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// ---------------------------------------------------------------------------
// Typed error -- carries exit code so main() can select 1 vs 2
// ---------------------------------------------------------------------------
class CliError extends Error {
  constructor(message, exitCode = EXIT_CODES.VALIDATION_ERROR) {
    super(message);
    this.name     = "CliError";
    this.exitCode = exitCode;
  }
}

function fail(message, exitCode = EXIT_CODES.VALIDATION_ERROR) {
  throw new CliError(message, exitCode);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const flags = {
    help: false, version: false, json: false,
    check: null, commit: null, note: null,
    unknown: [],
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":    case "-h": flags.help    = true; break;
      case "--version": case "-v": flags.version = true; break;
      case "--json":               flags.json    = true; break;

      case "--check":
      case "--commit":
      case "--note": {
        const key  = arg.slice(2); // "check" | "commit" | "note"
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("-")) { flags[key] = next; i++; }
        else flags.unknown.push(`${arg} (requires a value)`);
        break;
      }

      default:
        if (arg.startsWith("-")) {
          // Support --flag=value forms for --check / --commit / --note
          const eqIdx = arg.indexOf("=");
          if (eqIdx !== -1) {
            const key = arg.slice(2, eqIdx);
            if (key === "check" || key === "commit" || key === "note") {
              flags[key] = arg.slice(eqIdx + 1);
            } else {
              flags.unknown.push(arg);
            }
          } else {
            flags.unknown.push(arg);
          }
        } else {
          positionals.push(arg);
        }
    }
  }

  return { flags, positionals };
}

// ---------------------------------------------------------------------------
// Help / version
// ---------------------------------------------------------------------------
function printHelp() {
  console.log(`
Usage: node scripts/state/index.mjs <command> [options]

Commands:
  context                        Show project version, phase, and active tasks
  check                          Validate state.json and all task files
  task <id> <status>             Update task status
    --check <name>               Mark a check step as passed
    --commit <hash>              Attach a commit hash
    --note <text>                Add a transition note
  archive                        Move all done tasks to history and remove files
  version <x.y.z>               Update version in state.json and package.json

Valid task statuses: ${TASK_STATUSES.join(", ")}

Options:
  --json         Output as JSON (context, check, archive)
  --help, -h     Show this help
  --version, -v  Show version

Environment variables:
  STATE_DEBUG=1  Print stack traces on unexpected errors

Exit codes:
  0  success
  1  validation error or bad usage
  2  runtime / unexpected error

Examples:
  node scripts/state/index.mjs context
  node scripts/state/index.mjs check
  node scripts/state/index.mjs task v0.5.4-auth done --commit abc1234 --note "merged"
  node scripts/state/index.mjs version 0.6.0
`);
}

function printVersion() {
  const pkgPath = abs("package.json");
  try {
    const pkg = readJson(pkgPath);
    console.log(pkg.version || "unknown");
  } catch {
    console.log("unknown");
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
function cmdContext({ asJson }) {
  const state = loadState();
  const tasks = listTaskFiles().map(({ data }) => data);
  const byId  = new Map(tasks.map((t) => [t.id, t]));

  const activeTasks = Array.isArray(state.activeTaskIds)
    ? state.activeTaskIds.map((id) => {
        const t = byId.get(id);
        return t
          ? { id, status: t.status, title: t.title }
          : { id, status: "unknown", title: "(task file missing)" };
      })
    : [];

  const counts = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;

  if (asJson) {
    console.log(JSON.stringify({
      command:     "context",
      project:     state.project,
      version:     state.currentVersion,
      phase:       state.currentPhase,
      status:      state.status,
      branch:      state.baseBranch,
      syncedAt:    state.lastSyncedAt,
      activeTasks,
      taskCounts:  counts,
    }));
    return;
  }

  console.log(`${state.project} -- project state`);
  console.log("-".repeat(48));
  console.log(`Version : v${state.currentVersion}`);
  console.log(`Phase   : ${state.currentPhase}`);
  console.log(`Status  : ${state.status}`);
  console.log(`Branch  : ${state.baseBranch}`);
  console.log(`Synced  : ${state.lastSyncedAt}`);

  console.log("\nActive tasks:");
  if (activeTasks.length === 0) {
    console.log("  (none)");
  } else {
    for (const t of activeTasks) console.log(`  [${t.status}] ${t.id} -- ${t.title}`);
  }

  console.log("\nAll tasks by status:");
  for (const s of TASK_STATUSES) {
    if (counts[s]) console.log(`  ${s.padEnd(12)} ${counts[s]}`);
  }
}

function cmdCheck({ asJson }) {
  const { errors } = validateProjectState();

  if (asJson) {
    console.log(JSON.stringify({
      command: "check",
      status:  errors.length === 0 ? "ok" : "fail",
      errors,
    }));
    if (errors.length > 0) fail(`${errors.length} validation error(s).`);
    return;
  }

  if (errors.length === 0) {
    console.log("state:check -- state.json and all task files are valid.");
    return;
  }
  console.error(`state:check -- ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  FAIL  ${e}`);
  fail(`${errors.length} validation error(s).`);
}

function cmdTask(positionals, flags) {
  const id     = positionals[0];
  const status = positionals[1];
  if (!id || !status) {
    fail('usage: state task <id> <status> [--check name] [--commit hash] [--note "..."]');
  }
  if (!TASK_STATUSES.includes(status)) {
    fail(`invalid status "${status}". Allowed: ${TASK_STATUSES.join(", ")}`);
  }

  const entry = loadTask(id);
  if (!entry) fail(`task "${id}" not found in .project/tasks/`);
  const task     = entry.data;
  const previous = task.status;
  const at       = nowIso();

  if (flags.check) {
    if (!Array.isArray(task.checksPassed)) task.checksPassed = [];
    if (!task.checksPassed.includes(flags.check)) task.checksPassed.push(flags.check);
  }
  if (flags.commit) task.commitHash = String(flags.commit);

  task.status      = status;
  task.lastUpdated = at;
  if (!Array.isArray(task.transitions)) task.transitions = [];
  task.transitions.push({
    from: previous,
    to:   status,
    at,
    ...(flags.note ? { note: String(flags.note) } : {}),
  });

  const ruleErrors = validateTaskRules(task);
  if (ruleErrors.length > 0) {
    for (const e of ruleErrors) console.error(`  FAIL  ${e}`);
    fail(`cannot set "${id}" to "${status}": Definition of Done not met.`);
  }

  writeJson(entry.path, task);

  const state  = loadState();
  const active = new Set(Array.isArray(state.activeTaskIds) ? state.activeTaskIds : []);
  if (status === "done" || status === "archived") {
    active.delete(id);
  } else if (ACTIVE_STATUSES.has(status)) {
    active.add(id);
  }
  state.activeTaskIds = [...active].sort();
  saveState(state);

  console.log(`state:task -- ${id}: ${previous} -> ${status}`);
  if (flags.check)  console.log(`  check passed: ${flags.check}`);
  if (flags.commit) console.log(`  commit: ${task.commitHash}`);
}

function cmdArchive({ asJson }) {
  const state   = loadState();
  const history = readJson(HISTORY_FILE);
  const active  = new Set(Array.isArray(state.activeTaskIds) ? state.activeTaskIds : []);

  // Collect done tasks first -- do not delete anything until history is saved.
  const doneTasks = listTaskFiles().filter(({ data }) => data.status === "done");

  if (doneTasks.length === 0) {
    if (asJson) {
      console.log(JSON.stringify({ command: "archive", archived: [] }));
    } else {
      console.log("state:archive -- no done tasks to archive.");
    }
    return;
  }

  const now = nowIso();
  for (const { data } of doneTasks) {
    history.archivedTasks.push({ ...data, archivedAt: now });
    active.delete(data.id);
  }

  // Persist history before removing files: if a delete fails, data is not lost.
  writeJson(HISTORY_FILE, history);

  const archived = [];
  for (const { data, path } of doneTasks) {
    try {
      unlinkSync(path);
      archived.push(data.id);
    } catch (err) {
      fail(`cannot delete task file ${path}: ${err.message}`, EXIT_CODES.RUNTIME_ERROR);
    }
  }

  state.activeTaskIds = [...active].sort();
  saveState(state);

  if (asJson) {
    console.log(JSON.stringify({ command: "archive", archived }));
  } else {
    console.log(`state:archive -- moved ${archived.length} task(s) to history:`);
    for (const id of archived) console.log(`  ${id}`);
  }
}

function cmdVersion(positionals) {
  const next = positionals[0];
  if (!next) fail("usage: state version <x.y.z>");
  if (!SEMVER.test(next)) fail(`"${next}" is not a valid semver version`);

  const state    = loadState();
  const previous = state.currentVersion;
  state.currentVersion = next;
  state.lastSyncedAt   = nowIso();
  saveState(state);

  const pkgPath = abs("package.json");
  const pkg     = readJson(pkgPath);
  pkg.version   = next;
  writeJson(pkgPath, pkg);

  console.log(`state:version -- ${previous} -> ${next} (state.json + package.json).`);
  console.log("Next: run `npm run docs:sync` to propagate into the documents.");
}

// ---------------------------------------------------------------------------
// Command registry
// ---------------------------------------------------------------------------
const COMMANDS = {
  context: (positionals, flags) => cmdContext({ asJson: flags.json }),
  check:   (positionals, flags) => cmdCheck({ asJson: flags.json }),
  task:    (positionals, flags) => cmdTask(positionals, flags),
  archive: (positionals, flags) => cmdArchive({ asJson: flags.json }),
  version: (positionals, flags) => cmdVersion(positionals),
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }
  if (flags.version) {
    printVersion();
    process.exit(EXIT_CODES.SUCCESS);
  }
  if (flags.unknown.length > 0) {
    console.error(`state: unknown argument(s): ${flags.unknown.join(", ")}. Run with --help.`);
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }

  const command = positionals.shift() ?? "context";

  if (!(command in COMMANDS)) {
    console.error(`state: unknown command "${command}". Run with --help to see available commands.`);
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }

  try {
    COMMANDS[command](positionals, flags);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    if (err instanceof CliError) {
      console.error(`error: ${err.message}`);
      process.exit(err.exitCode);
    }
    console.error(`state: unexpected error -- ${err.message || err}`);
    if (process.env.STATE_DEBUG) console.error(err.stack ?? "");
    process.exit(EXIT_CODES.RUNTIME_ERROR);
  }
}

main();
