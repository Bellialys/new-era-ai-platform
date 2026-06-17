#!/usr/bin/env node
/**
 * Documentation sync engine.
 *
 *   node scripts/sync/index.mjs [sync] [--dry-run] [--json]
 *   node scripts/sync/index.mjs check [--strict] [--json]
 *   node scripts/sync/index.mjs restore [--list] [--json]
 *   node scripts/sync/index.mjs --help | --version
 *
 * Only content inside SYNC markers is generated. Manual text is never touched.
 *
 * Environment variables:
 *   DOCS_SYNC_DEBUG=1   Print stack traces on unexpected errors
 *
 * Exit codes:
 *   0  success
 *   1  validation error or bad arguments
 *   2  runtime / unexpected error
 */

import { readdirSync } from "node:fs";
import { join, relative, extname } from "node:path";
import {
  ROOT, abs, readText, writeText, readJson, fileExists, hasMarker,
  loadState, saveState, loadDocumentMap, validateProjectState,
  createBackup, restoreLatestBackup, globToRegExp, nowIso, relFromRoot,
  BACKUP_DIR,
} from "./utils.mjs";

import readme     from "./plugins/readme.mjs";
import roadmap    from "./plugins/roadmap.mjs";
import changelog  from "./plugins/changelog.mjs";
import agents     from "./plugins/agents.mjs";
import packageJson from "./plugins/package-json.mjs";

const readmeIndex = {
  ...readme,
  id: "readme-index",
  path: "00-readme.md",
  markers: ["PROJECT_VERSION"],
};

const PLUGINS = [readme, readmeIndex, roadmap, changelog, agents, packageJson];

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------
const EXIT_CODES = {
  SUCCESS:          0,
  VALIDATION_ERROR: 1,
  RUNTIME_ERROR:    2,
};

// Directories to exclude from recursive markdown scan
const SCAN_EXCLUDE = new Set(["node_modules", ".git", "dist", ".next", ".project", "archive"]);

// ---------------------------------------------------------------------------
// Typed errors: UserError -> exit 1, RuntimeError -> exit 2
// ---------------------------------------------------------------------------
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserError";
  }
}

class RuntimeError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "RuntimeError";
    if (cause) this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Help / version
// ---------------------------------------------------------------------------
function showHelp() {
  console.log(`
Usage: node scripts/sync/index.mjs [command] [options]

Commands:
  sync           Synchronise documents (default)
  check          Validate project state and documentation
  restore        Restore the latest backup

Options:
  --dry-run      Show planned changes without writing anything (sync only)
  --strict       Treat warnings as errors (check only)
  --list         List available backups (restore only)
  --json         Output results as JSON (all commands)
  --help, -h     Show this help
  --version, -v  Show version from package.json

Environment variables:
  DOCS_SYNC_DEBUG=1   Print stack traces on unexpected errors

Exit codes:
  0  success
  1  validation error or bad arguments
  2  runtime / unexpected error
`);
}

function showVersion() {
  const pkgPath = abs("package.json");
  if (fileExists(pkgPath)) {
    try {
      const pkg = readJson(pkgPath);
      console.log(pkg.version || "unknown");
    } catch {
      console.log("unknown");
    }
  } else {
    console.log("unknown (no package.json)");
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const flags = {
    help: false, version: false,
    command: null,
    dryRun: false, strict: false, list: false, json: false,
    unknown: [],
  };

  for (const arg of argv) {
    switch (arg) {
      case "--help":    case "-h": flags.help    = true; break;
      case "--version": case "-v": flags.version = true; break;
      case "--dry-run":            flags.dryRun  = true; break;
      case "--strict":             flags.strict  = true; break;
      case "--list":               flags.list    = true; break;
      case "--json":               flags.json    = true; break;
      default:
        if (arg.startsWith("-")) {
          flags.unknown.push(arg);
        } else if (flags.command === null) {
          flags.command = arg;
        } else {
          flags.unknown.push(arg);
        }
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Line-ending normalisation (CRLF -> LF)
// ---------------------------------------------------------------------------
const normalizeEol = (str) => str.replace(/\r\n/g, "\n");

// ---------------------------------------------------------------------------
// Safe I/O -- throws RuntimeError so callers can roll back before exiting
// ---------------------------------------------------------------------------
function safeReadText(absPath, label) {
  try {
    return readText(absPath);
  } catch (err) {
    throw new RuntimeError(`Failed to read ${label || absPath}: ${err.message}`, err);
  }
}

function safeReadJson(absPath, label) {
  try {
    return readJson(absPath);
  } catch (err) {
    throw new RuntimeError(`Failed to parse ${label || absPath}: ${err.message}`, err);
  }
}

function safeWriteText(absPath, content, label) {
  try {
    writeText(absPath, content);
  } catch (err) {
    throw new RuntimeError(`Failed to write ${label || absPath}: ${err.message}`, err);
  }
}

// ---------------------------------------------------------------------------
// Simple unified diff for dry-run output
// ---------------------------------------------------------------------------
function generateDiff(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let oldEnd = oldLines.length;
  let newEnd = newLines.length;
  while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) { oldEnd--; newEnd--; }
  if (start === oldLines.length && start === newLines.length) return "";
  const out = [];
  if (start > 0) out.push(`@@ -${start},${oldEnd - start} +${start},${newEnd - start} @@`);
  for (let i = start; i < oldEnd; i++) out.push(`- ${oldLines[i]}`);
  for (let i = start; i < newEnd; i++) out.push(`+ ${newLines[i]}`);
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Recursively collect *.md files, excluding known dirs
// ---------------------------------------------------------------------------
function collectMarkdownFiles(rootDir) {
  const result = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // skip unreadable dirs
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SCAN_EXCLUDE.has(entry.name)) walk(full);
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        result.push(relative(rootDir, full));
      }
    }
  }
  walk(rootDir);
  return result;
}

// ---------------------------------------------------------------------------
// List available backups
// ---------------------------------------------------------------------------
function listBackups(asJson = false) {
  if (!fileExists(BACKUP_DIR)) {
    if (asJson) {
      console.log(JSON.stringify({ command: "restore", list: [], message: "No backups directory found." }));
    } else {
      console.log("No backups directory found.");
    }
    return;
  }

  const stamps = readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  if (asJson) {
    const entries = stamps.map((stamp) => {
      const stampPath = join(BACKUP_DIR, stamp);
      let files = [];
      try { files = readdirSync(stampPath); } catch { /* ignore */ }
      return { stamp, files };
    });
    console.log(JSON.stringify({ command: "restore", list: entries }));
    return;
  }

  if (stamps.length === 0) {
    console.log("No backups available.");
    return;
  }
  console.log("Available backups:");
  for (const stamp of stamps) {
    const stampPath = join(BACKUP_DIR, stamp);
    let files = [];
    try { files = readdirSync(stampPath); } catch { /* ignore */ }
    console.log(`  [${stamp}]`);
    for (const f of files) console.log(`    - ${f}`);
  }
}

// ---------------------------------------------------------------------------
// Marker generation -- throws UserError on invalid state
// ---------------------------------------------------------------------------
function generateMarkers(state) {
  const missing = [];
  if (typeof state.currentVersion !== "string" || state.currentVersion === "") missing.push("currentVersion");
  if (typeof state.status !== "string" || state.status === "") missing.push("status");
  if (typeof state.currentPhase !== "string" && typeof state.currentPhase !== "number") missing.push("currentPhase");
  if (missing.length > 0) {
    throw new UserError(
      `Invalid project state: missing or empty field(s): ${missing.join(", ")}. Check .project/state.json.`
    );
  }
  return {
    PROJECT_VERSION: `**Текущая версия:** \`v${state.currentVersion}\``,
    PROJECT_STATUS:  `**Статус проекта:** \`${state.status}\``,
    CURRENT_PHASE:   `**Текущая фаза:** ${state.currentPhase}`,
  };
}

// ---------------------------------------------------------------------------
// Sync planning
// ---------------------------------------------------------------------------
function planSync(state) {
  // Guard: detect duplicate plugin paths
  const seen = new Set();
  for (const plugin of PLUGINS) {
    if (seen.has(plugin.path)) {
      throw new RuntimeError(`Duplicate target path in plugin list: "${plugin.path}".`);
    }
    seen.add(plugin.path);
  }

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
    const original = normalizeEol(safeReadText(absPath, plugin.path));

    let result;
    try {
      result = plugin.apply(original, ctx);
    } catch (err) {
      throw new RuntimeError(`Plugin "${plugin.path}" failed during apply: ${err.message}`, err);
    }

    const nextContent = normalizeEol(result.content);
    if (result.changes.length > 0 && nextContent !== original) {
      planned.push({ path: plugin.path, absPath, original, content: nextContent, changes: result.changes });
    }
  }

  return { planned, existingTargets };
}

// ---------------------------------------------------------------------------
// Sync command
// ---------------------------------------------------------------------------
function runSync({ dryRun, asJson }) {
  const startMs = Date.now();
  const state = loadState();
  const { planned, existingTargets } = planSync(state);

  if (dryRun) {
    if (asJson) {
      console.log(JSON.stringify({
        command: "sync",
        dryRun: true,
        changes: planned.map((item) => ({
          path: item.path,
          changes: item.changes,
          diff: generateDiff(item.original, item.content),
        })),
        elapsedMs: Date.now() - startMs,
      }));
    } else {
      if (planned.length === 0) {
        console.log("docs:sync -- documents already in sync.");
      } else {
        console.log(`docs:sync -- ${planned.length} file(s) would change:`);
        for (const item of planned) {
          console.log(`  * ${item.path}: ${item.changes.join(", ")}`);
          const diff = generateDiff(item.original, item.content);
          if (diff) console.log(diff.replace(/^/gm, "      "));
        }
      }
      console.log("\nDry run: no files written.");
    }
    return EXIT_CODES.SUCCESS;
  }

  if (planned.length === 0) {
    if (asJson) {
      console.log(JSON.stringify({
        command: "sync", status: "already_synced", filesUpdated: 0,
        elapsedMs: Date.now() - startMs,
      }));
    } else {
      console.log("docs:sync -- documents already in sync.");
    }
    return EXIT_CODES.SUCCESS;
  }

  // Backup before any writes
  const backup = createBackup([".project/state.json", ...existingTargets]);
  if (!asJson) console.log(`Backup created: ${relFromRoot(backup.dir)}`);

  // Write files -- rollback the entire batch on any failure
  const written = [];
  try {
    for (const item of planned) {
      safeWriteText(item.absPath, item.content, item.path);
      written.push(item.path);
    }
  } catch (err) {
    console.error(`Write failed after ${written.length} file(s); rolling back. ${err.message}`);
    try { restoreLatestBackup(); } catch (rbErr) {
      console.error(`Rollback also failed: ${rbErr.message}`);
    }
    throw err; // re-throw as RuntimeError -- main() will exit 2
  }

  state.lastSyncedAt = nowIso();
  saveState(state);

  const totalMs = Date.now() - startMs;
  if (asJson) {
    console.log(JSON.stringify({
      command: "sync",
      status: "ok",
      filesUpdated: written.length,
      files: written,
      backupDir: relFromRoot(backup.dir),
      lastSyncedAt: state.lastSyncedAt,
      elapsedMs: totalMs,
    }));
  } else {
    console.log(`docs:sync -- ${written.length} file(s) updated:`);
    for (const item of planned) console.log(`  * ${item.path}: ${item.changes.join(", ")}`);
    console.log(`State synced at ${state.lastSyncedAt}. (${totalMs}ms)`);
  }

  return EXIT_CODES.SUCCESS;
}

// ---------------------------------------------------------------------------
// Restore command
// ---------------------------------------------------------------------------
function runRestore({ list, asJson }) {
  if (list) {
    listBackups(asJson);
    return EXIT_CODES.SUCCESS;
  }

  const result = restoreLatestBackup();
  if (!result) {
    if (asJson) {
      console.log(JSON.stringify({ command: "restore", status: "no_backup", restored: [] }));
    } else {
      console.error("docs:restore -- no backup found.");
    }
    return EXIT_CODES.VALIDATION_ERROR;
  }

  if (asJson) {
    console.log(JSON.stringify({
      command: "restore",
      status: "ok",
      stamp: result.stamp,
      restored: result.restored,
    }));
  } else {
    console.log(`docs:restore -- restored backup ${result.stamp}:`);
    for (const file of result.restored) console.log(`  * ${file}`);
  }
  return EXIT_CODES.SUCCESS;
}

// ---------------------------------------------------------------------------
// Check command
// ---------------------------------------------------------------------------
function runCheck({ strict, asJson }) {
  const errors = [];
  const warnings = [];

  // 1. Project state validation
  const projectValidation = validateProjectState();
  const state = projectValidation.state;
  errors.push(...projectValidation.errors);

  // 2. package.json version check
  const pkgPath = abs("package.json");
  if (!fileExists(pkgPath)) {
    errors.push("package.json is missing.");
  } else {
    let pkg = null;
    try {
      pkg = safeReadJson(pkgPath, "package.json");
    } catch (err) {
      errors.push(err.message);
    }
    if (pkg !== null) {
      if (!pkg || typeof pkg.version !== "string") {
        errors.push("package.json does not contain a valid 'version' string.");
      } else if (pkg.version !== state.currentVersion) {
        errors.push(
          `package.json version "${pkg.version}" does not match state.currentVersion "${state.currentVersion}"`
        );
      }
    }
  }

  // 3. Document map
  const map = loadDocumentMap();

  // 3a. Cross-validate plugins vs syncedDocuments
  if (Array.isArray(map.syncedDocuments)) {
    const syncedPaths = new Set(map.syncedDocuments.map((d) => d.path));
    for (const plugin of PLUGINS) {
      if (!syncedPaths.has(plugin.path)) {
        warnings.push(`Plugin target "${plugin.path}" is not listed in document map syncedDocuments.`);
      }
    }
    // 3b. Synced documents: exist + required markers
    for (const doc of map.syncedDocuments) {
      const absPath = abs(doc.path);
      if (!fileExists(absPath)) {
        errors.push(`synced document missing: ${doc.path}`);
        continue;
      }
      if (Array.isArray(doc.requiredMarkers) && doc.requiredMarkers.length > 0) {
        let content;
        try {
          content = safeReadText(absPath, doc.path);
        } catch (err) {
          errors.push(err.message);
          continue;
        }
        for (const marker of doc.requiredMarkers) {
          if (!hasMarker(content, marker)) {
            errors.push(`${doc.path}: missing SYNC marker "${marker}" (run \`npm run docs:sync\`)`);
          }
        }
      }
    }
  } else {
    warnings.push("Document map does not contain syncedDocuments array; plugin cross-check skipped.");
  }

  // 4. Active documents existence
  for (const doc of map.activeDocuments || []) {
    if (!fileExists(abs(doc))) errors.push(`active document missing: ${doc}`);
  }

  // 5. Deprecated documents -- recursive scan
  const archiveDir = map.archiveDir || "archive";
  const allMdFiles = collectMarkdownFiles(ROOT);
  const deprecatedMatchers = (map.deprecatedPatterns || []).map(globToRegExp);
  for (const relPath of allMdFiles) {
    if (
      deprecatedMatchers.some((re) => re.test(relPath)) &&
      !relPath.startsWith(archiveDir + "/") &&
      relPath !== archiveDir
    ) {
      errors.push(`deprecated document "${relPath}" matches a deprecated pattern; move it to ${archiveDir}/`);
    }
  }
  for (const doc of map.deprecatedDocuments || []) {
    if (fileExists(abs(doc))) errors.push(`deprecated document "${doc}" must be moved to ${archiveDir}/`);
  }

  // 6. Strict mode: promote warnings to errors
  if (strict) {
    for (const w of warnings) errors.push(`[WARN->ERR] ${w}`);
  }

  if (asJson) {
    console.log(JSON.stringify({
      command: "check",
      status: errors.length === 0 ? "ok" : "fail",
      strict,
      errors,
      warnings: strict ? [] : warnings,
    }));
  } else {
    if (!strict && warnings.length > 0) {
      console.warn(`docs:check -- ${warnings.length} warning(s):`);
      for (const w of warnings) console.warn(`  WARN  ${w}`);
    }
    if (errors.length > 0) {
      console.error(`docs:check -- ${errors.length} problem(s):`);
      for (const e of errors) console.error(`  FAIL  ${e}`);
    } else {
      console.log("docs:check -- project state and documentation are in sync.");
    }
  }

  return errors.length > 0 ? EXIT_CODES.VALIDATION_ERROR : EXIT_CODES.SUCCESS;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    showHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (flags.version) {
    showVersion();
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (flags.unknown.length > 0) {
    console.error(`Unknown argument(s): ${flags.unknown.join(", ")}. Run with --help to see usage.`);
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }

  const command = flags.command ?? "sync";
  const asJson  = flags.json;

  let code = EXIT_CODES.SUCCESS;
  try {
    switch (command) {
      case "sync":
        code = runSync({ dryRun: flags.dryRun, asJson });
        break;
      case "check":
        code = runCheck({ strict: flags.strict, asJson });
        break;
      case "restore":
        code = runRestore({ list: flags.list, asJson });
        break;
      default:
        console.error(`Unknown command: "${command}". Run with --help to see usage.`);
        code = EXIT_CODES.VALIDATION_ERROR;
    }
  } catch (err) {
    const isUser = err instanceof UserError;

    if (asJson) {
      console.log(JSON.stringify({
        command,
        status: "error",
        error: err.message,
        type: err.name,
      }));
    } else {
      console.error(`Error: ${err.message}`);
    }

    if (process.env.DOCS_SYNC_DEBUG && !isUser) {
      console.error(err.stack ?? "");
    }

    code = isUser ? EXIT_CODES.VALIDATION_ERROR : EXIT_CODES.RUNTIME_ERROR;
  }

  process.exit(code);
}

main();
