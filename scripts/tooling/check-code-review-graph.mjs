#!/usr/bin/env node

import { existsSync, statSync } from "node:fs";

import {
  GRAPH_DATABASE_PATH,
  installationHelp,
  runCodeReviewGraph,
} from "./code-review-graph-runtime.mjs";

function fail(message, exitCode) {
  console.error(`[graph:doctor] ${message}`);
  process.exitCode = exitCode;
}

function firstDiagnostic(result) {
  const text = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim();
  return text.split(/\r?\n/, 1)[0] || "no diagnostic output";
}

const versionResult = runCodeReviewGraph(["--version"], { stdio: "pipe" });

if (versionResult.missing) {
  fail(`CRG is not installed.\n${installationHelp()}`, 2);
} else if (versionResult.error || versionResult.status !== 0) {
  fail(
    `CRG binary could not be executed: ${firstDiagnostic(versionResult)}`,
    2
  );
} else {
  console.log(`[graph:doctor] Installed: ${versionResult.stdout.trim()}`);

  if (!existsSync(GRAPH_DATABASE_PATH)) {
    fail(
      "Graph is not built. Run `npm run graph:build`; no build was started automatically.",
      3
    );
  } else if (statSync(GRAPH_DATABASE_PATH).size === 0) {
    fail("Graph storage exists but is empty.", 4);
  } else {
    const statusResult = runCodeReviewGraph(
      ["status", "--repo", ".", "--json"],
      { stdio: "pipe" }
    );

    if (statusResult.error || statusResult.status !== 0) {
      fail(
        `Graph storage is unreadable or damaged: ${firstDiagnostic(statusResult)}`,
        5
      );
    } else {
      try {
        const status = JSON.parse(statusResult.stdout);
        const nodes = Number(status.nodes);
        const edges = Number(status.edges);

        if (!Number.isFinite(nodes) || !Number.isFinite(edges)) {
          fail("CRG status did not return numeric node and edge counts.", 5);
        } else if (nodes <= 0 || edges <= 0) {
          fail(`Graph is empty (nodes=${nodes}, edges=${edges}).`, 4);
        } else {
          console.log(
            `[graph:doctor] Status OK: files=${status.files}, nodes=${nodes}, edges=${edges}.`
          );
          console.log(`[graph:doctor] Storage: ${GRAPH_DATABASE_PATH}`);
        }
      } catch (error) {
        fail(
          `CRG status returned invalid JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
          5
        );
      }
    }
  }
}
