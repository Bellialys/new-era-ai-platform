#!/usr/bin/env node
/**
 * Project state CLI. Prefer these commands over hand-editing the JSON.
 *
 *   node scripts/state/index.mjs context
 *   node scripts/state/index.mjs check
 *   node scripts/state/index.mjs task <id> <status> [--check name] [--commit hash] [--note "..."]
 *   node scripts/state/index.mjs archive
 *   node scripts/state/index.mjs version <x.y.z>
 */

import { unlinkSync } from "node:fs";
import {
  loadState,
  saveState,
  loadTask,
  listTaskFiles,
  writeJson,
  readJson,
  abs,
  HISTORY_FILE,
  validateProjectState,
  validateTaskRules,
  nowIso,
} from "../sync/utils.mjs";

const TASK_STATUSES = ["planned", "in_progress", "verify", "done", "blocked", "archived"];
const ACTIVE_STATUSES = new Set(["in_progress", "verify", "blocked"]);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function parseArgs(args) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key.includes("=")) {
        const [k, ...rest] = key.split("=");
        flags[k] = rest.join("=");
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[key] = args[i + 1];
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function cmdContext() {
  const state = loadState();
  const tasks = listTaskFiles().map(({ data }) => data);
  const byId = new Map(tasks.map((task) => [task.id, task]));

  console.log(`${state.project} — project state`);
  console.log("─".repeat(48));
  console.log(`Version : v${state.currentVersion}`);
  console.log(`Phase   : ${state.currentPhase}`);
  console.log(`Status  : ${state.status}`);
  console.log(`Branch  : ${state.baseBranch}`);
  console.log(`Synced  : ${state.lastSyncedAt}`);

  console.log("\nActive tasks:");
  if (!state.activeTaskIds || state.activeTaskIds.length === 0) {
    console.log("  (none)");
  } else {
    for (const id of state.activeTaskIds) {
      const task = byId.get(id);
      console.log(task ? `  • ${id} [${task.status}] ${task.title}` : `  • ${id} (missing task file)`);
    }
  }

  const counts = {};
  for (const task of tasks) counts[task.status] = (counts[task.status] || 0) + 1;
  console.log("\nAll tasks by status:");
  for (const status of TASK_STATUSES) {
    if (counts[status]) console.log(`  ${status.padEnd(12)} ${counts[status]}`);
  }
  return 0;
}

function cmdCheck() {
  const { errors } = validateProjectState();
  if (errors.length > 0) {
    console.error(`state:check — ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    return 1;
  }
  console.log("state:check — state.json and all task files are valid.");
  return 0;
}

function cmdTask(positionals, flags) {
  const id = positionals[0];
  const status = positionals[1];
  if (!id || !status) fail("usage: state:task <id> <status> [--check name] [--commit hash] [--note \"...\"]");
  if (!TASK_STATUSES.includes(status)) fail(`invalid status "${status}". Allowed: ${TASK_STATUSES.join(", ")}`);

  const entry = loadTask(id);
  if (!entry) fail(`task "${id}" not found in .project/tasks/`);
  const task = entry.data;
  const previous = task.status;
  const at = nowIso();

  if (flags.check) {
    if (!task.checksPassed.includes(flags.check)) task.checksPassed.push(flags.check);
  }
  if (flags.commit) {
    task.commitHash = String(flags.commit);
  }

  task.status = status;
  task.lastUpdated = at;
  task.transitions.push({
    from: previous,
    to: status,
    at,
    ...(flags.note ? { note: String(flags.note) } : {}),
  });

  const ruleErrors = validateTaskRules(task);
  if (ruleErrors.length > 0) {
    for (const error of ruleErrors) console.error(`  ✗ ${error}`);
    fail(`cannot set "${id}" to "${status}": Definition of Done not met.`);
  }

  writeJson(entry.path, task);

  // Keep state.activeTaskIds consistent with task lifecycle.
  const state = loadState();
  const active = new Set(state.activeTaskIds || []);
  if (status === "done" || status === "archived") {
    active.delete(id);
  } else if (ACTIVE_STATUSES.has(status)) {
    active.add(id);
  }
  state.activeTaskIds = [...active].sort();
  saveState(state);

  console.log(`state:task — ${id}: ${previous} -> ${status}`);
  if (flags.check) console.log(`  check passed: ${flags.check}`);
  if (flags.commit) console.log(`  commit: ${task.commitHash}`);
  return 0;
}

function cmdArchive() {
  const state = loadState();
  const history = readJson(HISTORY_FILE);
  const active = new Set(state.activeTaskIds || []);
  const archived = [];

  for (const { data, path } of listTaskFiles()) {
    if (data.status !== "done") continue;
    history.archivedTasks.push({ ...data, archivedAt: nowIso() });
    unlinkSync(path);
    active.delete(data.id);
    archived.push(data.id);
  }

  if (archived.length === 0) {
    console.log("state:archive — no done tasks to archive.");
    return 0;
  }

  state.activeTaskIds = [...active].sort();
  writeJson(HISTORY_FILE, history);
  saveState(state);

  console.log(`state:archive — moved ${archived.length} task(s) to history:`);
  for (const id of archived) console.log(`  • ${id}`);
  return 0;
}

function cmdVersion(positionals) {
  const next = positionals[0];
  if (!next) fail("usage: state:version <x.y.z>");
  if (!SEMVER.test(next)) fail(`"${next}" is not a valid semver version`);

  const state = loadState();
  const previous = state.currentVersion;
  state.currentVersion = next;
  state.lastSyncedAt = nowIso();
  saveState(state);

  const pkgPath = abs("package.json");
  const pkg = readJson(pkgPath);
  pkg.version = next;
  writeJson(pkgPath, pkg);

  console.log(`state:version — ${previous} -> ${next} (state.json + package.json).`);
  console.log("Next: run `npm run docs:sync` to propagate into the documents.");
  return 0;
}

function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const command = positionals.shift() || "context";

  let code = 0;
  switch (command) {
    case "context":
      code = cmdContext();
      break;
    case "check":
      code = cmdCheck();
      break;
    case "task":
      code = cmdTask(positionals, flags);
      break;
    case "archive":
      code = cmdArchive();
      break;
    case "version":
      code = cmdVersion(positionals);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Usage: node scripts/state/index.mjs [context|check|task|archive|version]");
      code = 1;
  }
  process.exit(code);
}

main();
