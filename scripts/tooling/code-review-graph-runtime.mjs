import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CODE_REVIEW_GRAPH_VERSION = "2.3.7";
export const TIKTOKEN_VERSION = "0.13.0";
export const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
export const GRAPH_DATABASE_PATH = join(
  REPOSITORY_ROOT,
  ".code-review-graph",
  "graph.db"
);

function commandCandidates() {
  const configuredBinary = process.env.CRG_BINARY?.trim();
  const candidates = [];

  if (configuredBinary) {
    candidates.push(
      isAbsolute(configuredBinary)
        ? configuredBinary
        : resolve(REPOSITORY_ROOT, configuredBinary)
    );
  }

  if (process.platform === "win32") {
    candidates.push(
      join(
        REPOSITORY_ROOT,
        ".tools",
        "code-review-graph-venv",
        "Scripts",
        "code-review-graph.exe"
      )
    );
  } else {
    candidates.push(
      join(
        REPOSITORY_ROOT,
        ".tools",
        "code-review-graph-venv",
        "bin",
        "code-review-graph"
      )
    );
  }

  candidates.push("code-review-graph");
  return [...new Set(candidates)];
}

/**
 * Run code-review-graph without a shell so arguments are passed literally.
 *
 * @param {string[]} args CLI arguments passed directly to CRG.
 * @param {{stdio?: "inherit"|"pipe", encoding?: BufferEncoding}} options Process options.
 * @returns {import("node:child_process").SpawnSyncReturns<string> & {command?: string, missing?: boolean}}
 */
export function runCodeReviewGraph(args, options = {}) {
  const stdio = options.stdio ?? "inherit";
  const encoding = options.encoding ?? "utf8";

  for (const command of commandCandidates()) {
    if (isAbsolute(command) && !existsSync(command)) {
      continue;
    }

    const result = spawnSync(command, args, {
      cwd: REPOSITORY_ROOT,
      encoding,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
      },
      shell: false,
      stdio,
      windowsHide: true,
    });

    if (result.error?.code === "ENOENT") {
      continue;
    }

    return Object.assign(result, { command });
  }

  return {
    pid: 0,
    output: [],
    stdout: "",
    stderr: "",
    status: null,
    signal: null,
    error: undefined,
    missing: true,
  };
}

/** Return the isolated Windows installation commands used by this repository. */
export function installationHelp() {
  return [
    `Install the pinned local tool (${CODE_REVIEW_GRAPH_VERSION}) from PowerShell:`,
    "  python -m venv .tools\\code-review-graph-venv",
    `  .\\.tools\\code-review-graph-venv\\Scripts\\python.exe -m pip install "code-review-graph[communities]==${CODE_REVIEW_GRAPH_VERSION}" "tiktoken==${TIKTOKEN_VERSION}"`,
    "Then run: npm run graph:build",
  ].join("\n");
}
