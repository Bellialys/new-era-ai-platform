import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  EXIT_CODES,
  OPENROUTER_IMAGE_MODELS_URL,
  OPENROUTER_TEXT_MODELS_URL,
  evaluateCatalogs,
  extractCatalogFromSources,
  fetchJsonWithRetry,
  fetchOpenRouterCatalogs,
  normalizeLiveModels,
  runCli,
} from "./verify-models.mjs";

const CATALOG = {
  textIds: ["provider/alpha:free", "provider/beta:free"],
  modelMinSelect: 2,
  defaults: {
    team: "provider/alpha:free",
    judgePrimary: "provider/beta:free",
    judgeFallback: "provider/alpha:free",
  },
  imageIds: ["provider/image-alpha"],
};

function textModels(ids = CATALOG.textIds, outputModalities = ["text"]) {
  return new Map(
    ids.map((id) => [id, { id, architecture: { output_modalities: outputModalities } }]),
  );
}

function imageModels({
  ids = CATALOG.imageIds,
  outputModalities = ["image"],
  supportedParameters = { aspect_ratio: { type: "enum" }, n: { type: "range" } },
} = {}) {
  return new Map(
    ids.map((id) => [
      id,
      {
        id,
        architecture: { output_modalities: outputModalities },
        supported_parameters: supportedParameters,
      },
    ]),
  );
}

test("extracts all literal catalogs, minimum, and runtime defaults", () => {
  const catalog = extractCatalogFromSources({
    models: `export const ALLOWED_MODELS = [{ id: "provider/alpha:free" }, { id: "provider/beta:free" }];`,
    teamMode: `export const TEAM_DEFAULT_MODEL_ID = "provider/alpha:free";`,
    constants: `const ARENA_CONSTANTS = {
      MODEL_MIN_SELECT: 2,
      JUDGE_PRIMARY_MODEL_ID: "provider/beta:free",
      JUDGE_FALLBACK_MODEL_ID: "provider/alpha:free",
    } as const;`,
    imageModels: `export const IMAGE_MODELS = [{ id: "provider/image-alpha" }] as const;`,
  });

  assert.deepEqual(catalog, CATALOG);
});

test("rejects computed catalog IDs instead of silently omitting them", () => {
  assert.throws(
    () =>
      extractCatalogFromSources({
        models: `const id = "provider/alpha:free"; export const ALLOWED_MODELS = [{ id }];`,
        teamMode: `export const TEAM_DEFAULT_MODEL_ID = "provider/alpha:free";`,
        constants: `const C = { MODEL_MIN_SELECT: 2, JUDGE_PRIMARY_MODEL_ID: "provider/beta:free", JUDGE_FALLBACK_MODEL_ID: "provider/alpha:free" };`,
        imageModels: `export const IMAGE_MODELS = [{ id: "provider/image-alpha" }];`,
      }),
    /without a literal id/,
  );
});

test("passes when text defaults and image capabilities match live discovery", () => {
  const result = evaluateCatalogs(CATALOG, textModels(), imageModels());

  assert.deepEqual(result, {
    status: "pass",
    text: {
      localCount: 2,
      liveCount: 2,
      minimumRequired: 2,
      minimumSatisfied: true,
      missing: [],
      duplicates: [],
      emptyIds: [],
      invalidOutputModality: [],
    },
    defaults: {
      team: {
        id: "provider/alpha:free",
        inLocalTextCatalog: true,
        inLiveTextCatalog: true,
      },
      judgePrimary: {
        id: "provider/beta:free",
        inLocalTextCatalog: true,
        inLiveTextCatalog: true,
      },
      judgeFallback: {
        id: "provider/alpha:free",
        inLocalTextCatalog: true,
        inLiveTextCatalog: true,
      },
      emptyIds: [],
      judgeModelsDistinct: true,
    },
    images: {
      localCount: 1,
      liveCount: 1,
      missing: [],
      duplicates: [],
      emptyIds: [],
      invalidOutputModality: [],
      missingRequiredParameters: [],
    },
  });
});

test("reports provider drift for text and image IDs", () => {
  const result = evaluateCatalogs(CATALOG, textModels([CATALOG.textIds[0]]), imageModels({ ids: [] }));

  assert.equal(result.status, "fail");
  assert.deepEqual(result.text.missing, ["provider/beta:free"]);
  assert.deepEqual(result.images.missing, ["provider/image-alpha"]);
});

test("fails when a selected text model does not advertise text output", () => {
  const result = evaluateCatalogs(CATALOG, textModels(CATALOG.textIds, ["image"]), imageModels());

  assert.equal(result.status, "fail");
  assert.deepEqual(result.text.invalidOutputModality, CATALOG.textIds);
});

test("fails when an image model does not advertise image output", () => {
  const result = evaluateCatalogs(
    CATALOG,
    textModels(),
    imageModels({ outputModalities: ["text"] }),
  );

  assert.equal(result.status, "fail");
  assert.deepEqual(result.images.invalidOutputModality, ["provider/image-alpha"]);
});

test("fails when an image model lacks aspect_ratio or n", () => {
  const result = evaluateCatalogs(
    CATALOG,
    textModels(),
    imageModels({ supportedParameters: { n: { type: "range" } } }),
  );

  assert.equal(result.status, "fail");
  assert.deepEqual(result.images.missingRequiredParameters, [
    { id: "provider/image-alpha", missing: ["aspect_ratio"] },
  ]);
});

test("requires at least MODEL_MIN_SELECT text models with a floor of two", () => {
  const tooSmall = {
    ...CATALOG,
    textIds: ["provider/alpha:free"],
  };
  const weakenedMinimum = {
    ...CATALOG,
    modelMinSelect: 1,
  };

  const tooSmallResult = evaluateCatalogs(tooSmall, textModels(), imageModels());
  const weakenedResult = evaluateCatalogs(weakenedMinimum, textModels(), imageModels());

  assert.equal(tooSmallResult.status, "fail");
  assert.equal(tooSmallResult.text.minimumSatisfied, false);
  assert.equal(weakenedResult.status, "fail");
  assert.equal(weakenedResult.text.minimumSatisfied, false);
});

test("requires Judge primary and fallback IDs to differ", () => {
  const catalog = {
    ...CATALOG,
    defaults: {
      ...CATALOG.defaults,
      judgeFallback: CATALOG.defaults.judgePrimary,
    },
  };
  const result = evaluateCatalogs(catalog, textModels(), imageModels());

  assert.equal(result.status, "fail");
  assert.equal(result.defaults.judgeModelsDistinct, false);
});

test("reports empty and duplicate local IDs as drift instead of parse failure", () => {
  const catalog = extractCatalogFromSources({
    models: `export const ALLOWED_MODELS = [
      { id: "provider/alpha:free" }, { id: "provider/alpha:free" }, { id: "" }, { id: "   " }
    ];`,
    teamMode: `export const TEAM_DEFAULT_MODEL_ID = "provider/alpha:free";`,
    constants: `const C = {
      MODEL_MIN_SELECT: 2,
      JUDGE_PRIMARY_MODEL_ID: "provider/beta:free",
      JUDGE_FALLBACK_MODEL_ID: "provider/alpha:free",
    };`,
    imageModels: `export const IMAGE_MODELS = [
      { id: "provider/image-alpha" }, { id: "provider/image-alpha" }, { id: "" }
    ];`,
  });
  const result = evaluateCatalogs(catalog, textModels(), imageModels());

  assert.equal(result.status, "fail");
  assert.deepEqual(result.text.emptyIds, ["", "   "]);
  assert.deepEqual(result.text.duplicates, ["provider/alpha:free"]);
  assert.deepEqual(result.images.emptyIds, [""]);
  assert.deepEqual(result.images.duplicates, ["provider/image-alpha"]);
});

test("reports empty Team or Judge defaults as drift", () => {
  const catalog = {
    ...CATALOG,
    defaults: { ...CATALOG.defaults, team: "  " },
  };
  const result = evaluateCatalogs(catalog, textModels(), imageModels());

  assert.equal(result.status, "fail");
  assert.deepEqual(result.defaults.emptyIds, ["team"]);
});

test("fails the local invariant when a runtime default is outside ALLOWED_MODELS", () => {
  const catalog = {
    ...CATALOG,
    defaults: { ...CATALOG.defaults, team: "provider/outside:free" },
  };
  const result = evaluateCatalogs(
    catalog,
    textModels([...CATALOG.textIds, "provider/outside:free"]),
    imageModels(),
  );

  assert.equal(result.status, "fail");
  assert.equal(result.defaults.team.inLocalTextCatalog, false);
  assert.equal(result.defaults.team.inLiveTextCatalog, true);
});

test("rejects malformed and duplicate live discovery rows", () => {
  assert.throws(
    () => normalizeLiveModels({ data: [{ id: "provider/ok" }, {}] }, "models"),
    /malformed model at data\[1\]/,
  );
  assert.throws(
    () => normalizeLiveModels({ data: [{ id: "provider/ok" }, { id: "provider/ok" }] }, "models"),
    /duplicate model ID/,
  );
  assert.throws(
    () => normalizeLiveModels({ data: [{ id: "   " }] }, "models"),
    /malformed model/,
  );
});

test("uses authenticated current discovery endpoints", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, authorization: init.headers.authorization });
    const data = url === OPENROUTER_TEXT_MODELS_URL
      ? [...textModels().values()]
      : [...imageModels().values()];
    return { ok: true, status: 200, json: async () => ({ data }) };
  };

  const result = await fetchOpenRouterCatalogs("test-key", { fetchImpl });

  assert.equal(result.textModels.size, 2);
  assert.equal(result.imageModels.size, 1);
  assert.deepEqual(
    calls.sort((left, right) => left.url.localeCompare(right.url)),
    [
      { url: OPENROUTER_IMAGE_MODELS_URL, authorization: "Bearer test-key" },
      { url: OPENROUTER_TEXT_MODELS_URL, authorization: "Bearer test-key" },
    ].sort((left, right) => left.url.localeCompare(right.url)),
  );
});

test("does not retry authentication failures", async (context) => {
  for (const status of [401, 403]) {
    await context.test(`HTTP ${status}`, async () => {
      let attempts = 0;
      await assert.rejects(
        fetchJsonWithRetry("https://example.test/models", "bad-key", {
          maxAttempts: 3,
          delay: async () => {},
          fetchImpl: async () => {
            attempts += 1;
            return { ok: false, status, json: async () => ({}) };
          },
        }),
        new RegExp(`auth failed \\(HTTP ${status}\\)`),
      );
      assert.equal(attempts, 1);
    });
  }
});

test("retries transient HTTP responses", async () => {
  let attempts = 0;
  const body = await fetchJsonWithRetry("https://example.test/models", "test-key", {
    maxAttempts: 2,
    delay: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(body, { data: [] });
});

test("exhausts timeout retries", async () => {
  let attempts = 0;
  await assert.rejects(
    fetchJsonWithRetry("https://example.test/models", "test-key", {
      maxAttempts: 2,
      timeoutMs: 5,
      delay: async () => {},
      fetchImpl: async (_url, init) => {
        attempts += 1;
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true },
          );
        });
      },
    }),
    /timed out/,
  );
  assert.equal(attempts, 2);
});

test("exhausts network retries", async () => {
  let attempts = 0;
  await assert.rejects(
    fetchJsonWithRetry("https://example.test/models", "test-key", {
      maxAttempts: 3,
      delay: async () => {},
      fetchImpl: async () => {
        attempts += 1;
        throw new TypeError("network unavailable");
      },
    }),
    /network unavailable/,
  );
  assert.equal(attempts, 3);
});

test("rejects invalid JSON without retrying", async () => {
  let attempts = 0;
  await assert.rejects(
    fetchJsonWithRetry("https://example.test/models", "test-key", {
      maxAttempts: 3,
      delay: async () => {},
      fetchImpl: async () => {
        attempts += 1;
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("invalid json");
          },
        };
      },
    }),
    /returned invalid JSON/,
  );
  assert.equal(attempts, 1);
});

test("runCli preserves pass, drift, and runtime exit codes", async () => {
  const output = [];
  const commonOptions = {
    env: { OPENROUTER_API_KEY: "test-key" },
    loadEnvironment: false,
    stdout: (message) => output.push(message),
    stderr: (message) => output.push(message),
    readCatalog: async () => CATALOG,
  };

  const passCode = await runCli(["--json"], {
    ...commonOptions,
    fetchCatalogs: async () => ({ textModels: textModels(), imageModels: imageModels() }),
  });
  const driftCode = await runCli(["--json"], {
    ...commonOptions,
    fetchCatalogs: async () => ({ textModels: textModels([]), imageModels: imageModels() }),
  });
  const runtimeCode = await runCli(["--json"], {
    ...commonOptions,
    fetchCatalogs: async () => {
      normalizeLiveModels({ data: [{}] }, "models");
    },
  });

  assert.equal(passCode, EXIT_CODES.PASS);
  assert.equal(driftCode, EXIT_CODES.MISSING);
  assert.equal(runtimeCode, EXIT_CODES.RUNTIME_ERROR);
  assert.match(output[0], /^\{"status":"pass","text":/);
  assert.match(output.at(-1), /^\{"status":"error","reason":"runtime_error"/);
});

test("missing key emits JSON runtime error before reading files or fetching", async () => {
  const output = [];
  let dependencyCalled = false;
  const code = await runCli(["--json"], {
    env: {},
    loadEnvironment: false,
    stdout: (message) => output.push(message),
    stderr: (message) => output.push(message),
    readCatalog: async () => {
      dependencyCalled = true;
    },
    fetchCatalogs: async () => {
      dependencyCalled = true;
    },
  });

  assert.equal(code, EXIT_CODES.RUNTIME_ERROR);
  assert.equal(dependencyCalled, false);
  assert.deepEqual(JSON.parse(output[0]), {
    status: "error",
    reason: "runtime_error",
    message: "OPENROUTER_API_KEY is not set. Add it to .env.local or repository secrets.",
  });
});

test("importing the verifier has no CLI side effects", () => {
  const scriptUrl = new URL("./verify-models.mjs", import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `await import(${JSON.stringify(scriptUrl)});`],
    { encoding: "utf8" },
  );

  assert.equal(child.status, 0);
  assert.equal(child.stdout, "");
  assert.equal(child.stderr, "");
});
