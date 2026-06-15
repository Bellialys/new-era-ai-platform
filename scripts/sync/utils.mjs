/**
 * Shared helpers for the Project State Sync System.
 *
 * Dependency-free on purpose: this runs in CI with `npm ci` and must not pull
 * extra packages. The JSON Schema validator below implements only the subset of
 * draft 2020-12 used by .project/*.schema.json (type, enum, required,
 * properties, items, pattern, minLength, minItems, format:date-time,
 * additionalProperties:false). Keywords it does not understand (allOf/if/then)
 * are ignored; cross-field rules live in validateTaskRules().
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  statSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const PROJECT_DIR = join(ROOT, ".project");
export const STATE_FILE = join(PROJECT_DIR, "state.json");
export const STATE_SCHEMA_FILE = join(PROJECT_DIR, "state.schema.json");
export const TASK_SCHEMA_FILE = join(PROJECT_DIR, "task.schema.json");
export const DOC_MAP_FILE = join(PROJECT_DIR, "document-map.json");
export const HISTORY_FILE = join(PROJECT_DIR, "history.json");
export const TASKS_DIR = join(PROJECT_DIR, "tasks");
export const BACKUP_DIR = join(PROJECT_DIR, "backups");

// --- IO -------------------------------------------------------------------

export function nowIso() {
  return new Date().toISOString();
}

export function readText(absPath) {
  return readFileSync(absPath, "utf8");
}

export function writeText(absPath, content) {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content, "utf8");
}

export function readJson(absPath) {
  return JSON.parse(readText(absPath));
}

export function writeJson(absPath, value) {
  writeText(absPath, JSON.stringify(value, null, 2) + "\n");
}

export function fileExists(absPath) {
  return existsSync(absPath);
}

export function abs(relPath) {
  return join(ROOT, relPath);
}

// --- Domain loaders -------------------------------------------------------

export function loadState() {
  return readJson(STATE_FILE);
}

export function saveState(state) {
  writeJson(STATE_FILE, state);
}

export function loadDocumentMap() {
  return readJson(DOC_MAP_FILE);
}

export function listTaskFiles() {
  if (!existsSync(TASKS_DIR)) return [];
  return readdirSync(TASKS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const path = join(TASKS_DIR, name);
      return { name, path, data: readJson(path) };
    });
}

export function loadTask(id) {
  const path = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return { name: `${id}.json`, path, data: readJson(path) };
}

// --- Minimal JSON Schema validator ---------------------------------------

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(typeSpec, value) {
  const types = Array.isArray(typeSpec) ? typeSpec : [typeSpec];
  const actual = typeOf(value);
  return types.some((t) => {
    if (t === "number") return actual === "number" || actual === "integer";
    if (t === "integer") return actual === "integer";
    return actual === t;
  });
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function walkSchema(schema, data, path, errors) {
  if (!schema || typeof schema !== "object") return;

  if (schema.enum && !schema.enum.some((option) => deepEqual(option, data))) {
    errors.push(`${path || "(root)"}: ${JSON.stringify(data)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (schema.type !== undefined && data !== undefined) {
    if (!matchesType(schema.type, data)) {
      errors.push(`${path || "(root)"}: expected type ${JSON.stringify(schema.type)} but got ${typeOf(data)}`);
      return;
    }
  }

  const actual = typeOf(data);

  if (actual === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      errors.push(`${path}: string is shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: "${data}" does not match pattern ${schema.pattern}`);
    }
    if (schema.format === "date-time" && (!ISO_DATE_TIME.test(data) || Number.isNaN(Date.parse(data)))) {
      errors.push(`${path}: "${data}" is not a valid ISO date-time`);
    }
  }

  if (actual === "array") {
    if (typeof schema.minItems === "number" && data.length < schema.minItems) {
      errors.push(`${path}: array has fewer than ${schema.minItems} items`);
    }
    if (schema.items) {
      data.forEach((item, index) => walkSchema(schema.items, item, `${path}[${index}]`, errors));
    }
  }

  if (actual === "object") {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (data[key] === undefined) {
          errors.push(`${path || "(root)"}: missing required property "${key}"`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (data[key] !== undefined) {
          walkSchema(subSchema, data[key], path ? `${path}.${key}` : key, errors);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) {
          errors.push(`${path || "(root)"}: unexpected property "${key}"`);
        }
      }
    }
  }
}

export function validateAgainstSchema(schema, data) {
  const errors = [];
  walkSchema(schema, data, "", errors);
  return errors;
}

/** Cross-field rules that plain JSON Schema cannot express in this validator. */
export function validateTaskRules(task) {
  const errors = [];
  const id = task && task.id ? task.id : "(task)";

  if (task && task.status === "done") {
    if (!task.commitHash) {
      errors.push(`${id}: status "done" requires a commitHash`);
    }
    const required = Array.isArray(task.checksRequired) ? task.checksRequired : [];
    const passed = Array.isArray(task.checksPassed) ? task.checksPassed : [];
    const missing = required.filter((check) => !passed.includes(check));
    if (missing.length > 0) {
      errors.push(`${id}: status "done" requires checksPassed to include all checksRequired (missing: ${missing.join(", ")})`);
    }
  }

  return errors;
}

// --- SYNC markers ---------------------------------------------------------

export const MARKER_PREFIX = "SYNC:";

export function markerStart(name) {
  return `<!-- ${MARKER_PREFIX}${name}_START -->`;
}

export function markerEnd(name) {
  return `<!-- ${MARKER_PREFIX}${name}_END -->`;
}

export function hasMarker(content, name) {
  return content.includes(markerStart(name)) && content.includes(markerEnd(name));
}

/** Detect the dominant line ending so regenerated blocks match the file. */
function detectEol(content) {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function markerBlock(name, generated, eol = "\n") {
  const body = String(generated).replace(/\r?\n/g, eol);
  return `${markerStart(name)}${eol}${body}${eol}${markerEnd(name)}`;
}

/**
 * Replace the content between an existing marker pair, or insert a fresh marker
 * block after the first line matching `anchor` (falling back to the top of the
 * file). Never deletes text outside the markers.
 *
 * The generated block is emitted in the file's own newline style (CRLF or LF)
 * so a Windows (CRLF) checkout does not report false drift in `--dry-run`.
 *
 * Returns { content, changed, inserted }.
 */
export function applyMarker(content, name, generated, anchor) {
  const eol = detectEol(content);
  const block = markerBlock(name, generated, eol);

  if (hasMarker(content, name)) {
    const pattern = new RegExp(
      `${escapeRegExp(markerStart(name))}[\\s\\S]*?${escapeRegExp(markerEnd(name))}`
    );
    const next = content.replace(pattern, block);
    return { content: next, changed: next !== content, inserted: false };
  }

  const lines = content.split(/\r?\n/);
  let insertAt = 0;
  if (anchor) {
    const index = lines.findIndex((line) => anchor.test(line));
    if (index !== -1) {
      insertAt = index + 1;
    }
  } else {
    const headingIndex = lines.findIndex((line) => /^#\s/.test(line));
    if (headingIndex !== -1) insertAt = headingIndex + 1;
  }

  const before = lines.slice(0, insertAt).join(eol);
  const after = lines.slice(insertAt).join(eol);
  const next = `${before}${eol}${eol}${block}${eol}${after.startsWith(eol) ? after : eol + after}`;
  return { content: next, changed: true, inserted: true };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Backups --------------------------------------------------------------

function flatten(relPath) {
  return relPath.replace(/[\\/]/g, "__");
}

export function createBackup(relFiles) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(BACKUP_DIR, stamp);
  mkdirSync(dir, { recursive: true });

  const files = [];
  for (const rel of relFiles) {
    const source = join(ROOT, rel);
    if (!existsSync(source)) continue;
    const stored = flatten(rel);
    copyFileSync(source, join(dir, stored));
    files.push({ file: rel, stored });
  }

  writeJson(join(dir, "manifest.json"), { createdAt: nowIso(), files });
  writeText(join(BACKUP_DIR, "latest.txt"), stamp + "\n");
  return { dir, stamp, files };
}

export function latestBackup() {
  const pointer = join(BACKUP_DIR, "latest.txt");
  if (existsSync(pointer)) {
    const stamp = readText(pointer).trim();
    const dir = join(BACKUP_DIR, stamp);
    if (existsSync(dir)) return { dir, stamp };
  }
  if (!existsSync(BACKUP_DIR)) return null;
  const stamps = readdirSync(BACKUP_DIR)
    .filter((name) => statSync(join(BACKUP_DIR, name)).isDirectory())
    .sort();
  if (stamps.length === 0) return null;
  const stamp = stamps[stamps.length - 1];
  return { dir: join(BACKUP_DIR, stamp), stamp };
}

export function restoreLatestBackup() {
  const backup = latestBackup();
  if (!backup) return null;
  const manifest = readJson(join(backup.dir, "manifest.json"));
  const restored = [];
  for (const entry of manifest.files) {
    const source = join(backup.dir, entry.stored);
    if (!existsSync(source)) continue;
    copyFileSync(source, join(ROOT, entry.file));
    restored.push(entry.file);
  }
  return { stamp: backup.stamp, restored };
}

// --- Console helpers ------------------------------------------------------

export function relFromRoot(absPath) {
  return relative(ROOT, absPath).replace(/\\/g, "/");
}

export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

// --- Aggregate validation -------------------------------------------------

/**
 * Validate state.json and every task file against their schemas plus the
 * cross-field task rules. Returns { state, tasks, taskIds, errors }.
 * Shared by `state:check` and `docs:check`.
 */
export function validateProjectState() {
  const errors = [];
  const stateSchema = readJson(STATE_SCHEMA_FILE);
  const taskSchema = readJson(TASK_SCHEMA_FILE);

  const state = loadState();
  for (const error of validateAgainstSchema(stateSchema, state)) {
    errors.push(`state.json: ${error}`);
  }

  const tasks = listTaskFiles();
  const taskIds = new Set();
  for (const { name, data } of tasks) {
    for (const error of validateAgainstSchema(taskSchema, data)) {
      errors.push(`tasks/${name}: ${error}`);
    }
    for (const error of validateTaskRules(data)) {
      errors.push(`tasks/${name}: ${error}`);
    }
    if (data.id && `${data.id}.json` !== name) {
      errors.push(`tasks/${name}: id "${data.id}" does not match filename`);
    }
    if (data.id) {
      if (taskIds.has(data.id)) errors.push(`duplicate task id "${data.id}"`);
      taskIds.add(data.id);
    }
  }

  for (const id of state.activeTaskIds || []) {
    if (!taskIds.has(id)) {
      errors.push(`state.json: activeTaskIds references unknown task "${id}"`);
    }
  }

  return { state, tasks, taskIds, errors };
}
