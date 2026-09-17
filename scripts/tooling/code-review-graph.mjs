#!/usr/bin/env node

import {
  installationHelp,
  runCodeReviewGraph,
} from "./code-review-graph-runtime.mjs";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    "Usage: node scripts/tooling/code-review-graph.mjs <command> [arguments]"
  );
  process.exitCode = 2;
} else {
  const result = runCodeReviewGraph(args);

  if (result.missing) {
    console.error(`code-review-graph is not installed.\n${installationHelp()}`);
    process.exitCode = 2;
  } else if (result.error) {
    console.error(`Unable to start code-review-graph: ${result.error.message}`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
