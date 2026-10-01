import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SAFE_BUILD_SKIP_PATTERNS = [
  /^docs\//,
  /^archive\//,
  /^[0-9]{2}-[^/]+\.md$/,
  /^(?:README|SECURITY|AGENTS|CLAUDE|PROJECT-CONTEXT)\.md$/,
  /^\.project\/state\.json$/,
  /^\.project\/tasks\/[^/]+\.json$/,
];

export function isSafeBuildSkipPath(filePath) {
  return SAFE_BUILD_SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function shouldSkipVercelBuild({ changedPaths }) {
  return (
    changedPaths.length > 0 &&
    changedPaths.every(isSafeBuildSkipPath)
  );
}

export function getComparisonBase({ previousSha }) {
  const explicitBase = previousSha?.trim();
  return explicitBase || "HEAD^1";
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
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA ?? "";
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA ?? "HEAD";
  const comparisonBase = getComparisonBase({ previousSha });
  const changedPaths = getChangedPaths({
    previousSha: comparisonBase,
    currentSha,
  });

  if (changedPaths === null) {
    process.stdout.write(
      "[vercel-ignore] Build required: Git comparison failed.\n",
    );
    process.exit(1);
  }

  if (shouldSkipVercelBuild({ changedPaths })) {
    process.stdout.write(
      `[vercel-ignore] Skipping build for docs/state-only change (${changedPaths.length} file(s)).\n`,
    );
    process.exit(0);
  }

  process.stdout.write(
    `[vercel-ignore] Build required (${changedPaths.length} changed file(s)).\n`,
  );
  process.exit(1);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main();
}
