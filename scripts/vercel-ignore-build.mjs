import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SAFE_PREVIEW_ONLY_PATTERNS = [
  /^docs\//,
  /^archive\//,
  /^[0-9]{2}-[^/]+\.md$/,
  /^(?:README|SECURITY|AGENTS|CLAUDE|PROJECT-CONTEXT)\.md$/,
  /^\.project\/state\.json$/,
  /^\.project\/tasks\/[^/]+\.json$/,
];

export function isSafePreviewOnlyPath(filePath) {
  return SAFE_PREVIEW_ONLY_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function shouldSkipVercelPreviewBuild({ vercelEnv, changedPaths }) {
  return (
    vercelEnv === "preview" &&
    changedPaths.length > 0 &&
    changedPaths.every(isSafePreviewOnlyPath)
  );
}

export function getChangedPaths({
  previousSha,
  currentSha = "HEAD",
  cwd = process.cwd(),
}) {
  if (!previousSha?.trim()) {
    return null;
  }

  try {
    const output = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        "--no-renames",
        "--diff-filter=ACMRD",
        previousSha,
        currentSha,
        "--",
      ],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    return output
      .split(/\r?\n/u)
      .map((filePath) => filePath.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function main() {
  const vercelEnv = process.env.VERCEL_ENV ?? "";
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA ?? "";
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA ?? "HEAD";
  const changedPaths = getChangedPaths({ previousSha, currentSha });

  if (changedPaths === null) {
    process.stdout.write(
      "[vercel-ignore] Build required: Git comparison unavailable or previous SHA missing.\n",
    );
    process.exit(1);
  }

  if (shouldSkipVercelPreviewBuild({ vercelEnv, changedPaths })) {
    process.stdout.write(
      `[vercel-ignore] Skipping Preview build for docs/state-only change (${changedPaths.length} file(s)).\n`,
    );
    process.exit(0);
  }

  process.stdout.write(
    `[vercel-ignore] Build required for ${vercelEnv || "unknown"} environment (${changedPaths.length} changed file(s)).\n`,
  );
  process.exit(1);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main();
}
