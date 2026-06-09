#!/usr/bin/env node
/**
 * Documentation sync engine.
 *
 *   node scripts/sync/index.mjs            # sync docs from .project/state.json
 *   node scripts/sync/index.mjs --dry-run  # show changes, write nothing
 *   node scripts/sync/index.mjs check      # fail (exit 1) on any desync
 *   node scripts/sync/index.mjs restore    # restore the latest backup
 *
 * Only content inside SYNC markers is generated. Manual text is never touched.
 */

import { readdirSync } from "node:fs";
import {
  ROOT,
  abs,
  readText,
  writeText,
  readJson,
  fileExists,
  hasMarker,
  loadState,
  saveState,
  loadDocumentMap,
  validateProjectState,
  createBackup,
  restoreLatestBackup,
  globToRegExp,
  nowIso,
  relFromRoot,
} from "./utils.mjs";

import readme from "./plugins/readme.mjs";
import roadmap from "./plugins/roadmap.mjs";
import changelog from "./plugins/changelog.mjs";
import agents from "./plugins/agents.mjs";
import packageJson from "./plugins/package-json.mjs";

const PLUGINS = [readme, roadmap, changelog, agents, packageJson];

function generateMarkers(state) {
  return {
    PROJECT_VERSION: `**Текущая версия:** \`v${state.currentVersion}\``,
    PROJECT_STATUS: `**Статус проекта:** \`${state.status}\``,
    CURRENT_PHASE: `**Текущая фаза:** ${state.currentPhase}`,
  };
}

function planSync(state) {
  const ctx = { state, markers: generateMarkers(state) };
  const planned = [];
  const existingTargets = [];

  for (const plugin of PLUGINS) {
    const absPath = abs(plugin.path);
    if (!fileExists(absPath)) {
      console.warn(`! skip ${plugin.path} (not found)`);
      continue;
    }
    existingTargets.push(plugin.path);
    const content = readText(absPath);
    const { content: nextContent, changes } = plugin.apply(content, ctx);
    if (changes.length > 0 && nextContent !== content) {
      planned.push({ path: plugin.path, absPath, content: nextContent, changes });
    }
  }

  return { planned, existingTargets };
}

function runSync({ dryRun }) {
  const state = loadState();
  const { planned, existingTargets } = planSync(state);

  if (planned.length === 0) {
    console.log("docs:sync — documents already in sync.");
  } else {
    console.log(`docs:sync — ${planned.length} file(s) ${dryRun ? "would change" : "to update"}:`);
    for (const item of planned) {
      console.log(`  • ${item.path}: ${item.changes.join(", ")}`);
    }
  }

  if (dryRun) {
    console.log("\nDry run: no files written.");
    return 0;
  }

  const backup = createBackup([".project/state.json", ...existingTargets]);
  console.log(`Backup created: ${relFromRoot(backup.dir)}`);

  for (const item of planned) {
    writeText(item.absPath, item.content);
  }

  state.lastSyncedAt = nowIso();
  saveState(state);
  console.log(`State synced at ${state.lastSyncedAt}.`);
  return 0;
}

function runRestore() {
  const result = restoreLatestBackup();
  if (!result) {
    console.error("docs:restore — no backup found.");
    return 1;
  }
  console.log(`docs:restore — restored backup ${result.stamp}:`);
  for (const file of result.restored) {
    console.log(`  • ${file}`);
  }
  return 0;
}

function runCheck() {
  const projectValidation = validateProjectState();
  const state = projectValidation.state;
  const errors = [...projectValidation.errors];

  // package.json version must match the single source of truth.
  const pkg = readJson(abs("package.json"));
  if (pkg.version !== state.currentVersion) {
    errors.push(`package.json version "${pkg.version}" does not match state.currentVersion "${state.currentVersion}"`);
  }

  const map = loadDocumentMap();

  // Synced documents must exist and carry their required SYNC markers.
  for (const doc of map.syncedDocuments || []) {
    const absPath = abs(doc.path);
    if (!fileExists(absPath)) {
      errors.push(`synced document missing: ${doc.path}`);
      continue;
    }
    if (Array.isArray(doc.requiredMarkers) && doc.requiredMarkers.length > 0) {
      const content = readText(absPath);
      for (const marker of doc.requiredMarkers) {
        if (!hasMarker(content, marker)) {
          errors.push(`${doc.path}: missing SYNC marker "${marker}" (run \`npm run docs:sync\`)`);
        }
      }
    }
  }

  // Active documents declared in the map must exist.
  for (const doc of map.activeDocuments || []) {
    if (!fileExists(abs(doc))) {
      errors.push(`active document missing: ${doc}`);
    }
  }

  // Stale status/addendum/override docs must live in archive/, not the root.
  const archiveDir = map.archiveDir || "archive";
  const rootMarkdown = readdirSync(ROOT).filter((name) => name.endsWith(".md"));
  const deprecatedMatchers = (map.deprecatedPatterns || []).map(globToRegExp);
  for (const name of rootMarkdown) {
    if (deprecatedMatchers.some((re) => re.test(name))) {
      errors.push(`deprecated document "${name}" must be moved to ${archiveDir}/`);
    }
  }
  for (const doc of map.deprecatedDocuments || []) {
    if (fileExists(abs(doc))) {
      errors.push(`deprecated document "${doc}" must be moved to ${archiveDir}/`);
    }
  }

  if (errors.length > 0) {
    console.error(`docs:check — ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    return 1;
  }

  console.log("docs:check — project state and documentation are in sync.");
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  const command = args.find((arg) => !arg.startsWith("-")) || "sync";
  const dryRun = args.includes("--dry-run");

  let code = 0;
  switch (command) {
    case "sync":
      code = runSync({ dryRun });
      break;
    case "check":
      code = runCheck();
      break;
    case "restore":
      code = runRestore();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Usage: node scripts/sync/index.mjs [sync|check|restore] [--dry-run]");
      code = 1;
  }
  process.exit(code);
}

main();
