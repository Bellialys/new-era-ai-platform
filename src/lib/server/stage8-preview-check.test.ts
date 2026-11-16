import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as judge } from "@/app/api/judge/route";
import { POST as team } from "@/app/api/team-run/route";
import { JUDGE_FALLBACK_MODEL_ID, JUDGE_PRIMARY_MODEL_ID } from "@/lib/arena/constants";
import { TEAM_DEFAULT_MODEL_ID } from "@/lib/arena/team-mode";

const state = vi.hoisted(() => ({
  models: [] as Record<string, unknown>[],
  saveArenaRun: vi.fn(async () => ({ taskId: null, responseIdsByModelId: {} })),
}));

vi.mock("@/lib/server/supabase", async (original) => ({
  ...await original<typeof import("@/lib/server/supabase")>(),
  getSupabaseServerClient: () => ({
    from(table: string) {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { role: "user", plan: "free" } }) }) }) };
      }
      if (table !== "models") throw new Error("Unexpected database access in Preview verification.");
      let rows = [...state.models];
      const query = {
        select: () => query,
        eq(name: string, value: unknown) {
          rows = rows.filter((row) => row[name] === value);
          return query;
        },
        in(name: string, values: unknown[]) {
          rows = rows.filter((row) => values.includes(row[name]));
          return query;
        },
        order: async () => ({ data: rows, error: null }),
      };
      return query;
    },
  }),
}));

vi.mock("@/lib/server/openrouter-usage", async (original) => ({
  ...await original<typeof import("@/lib/server/openrouter-usage")>(),
  recordOpenRouterUsageEventBestEffort: vi.fn(),
}));

vi.mock("@/lib/server", async (original) => ({
  ...await original<typeof import("@/lib/server")>(),
  resolveRequestIdentity: async () => ({ kind: "user", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", guestId: null }),
  checkRateLimit: async () => ({ limited: false }),
  saveArenaRun: state.saveArenaRun,
  resolveOpenRouterRuntimeCredential: async () => ({
    apiKey: process.env.OPENROUTER_API_KEY,
    billingSource: "platform",
    credentialId: null,
  }),
}));

const fetchFromOpenRouter = globalThis.fetch;
const allowed = new Set([JUDGE_PRIMARY_MODEL_ID, JUDGE_FALLBACK_MODEL_ID, TEAM_DEFAULT_MODEL_ID]);
const providerCalls: { model: string; status: number }[] = [];
let attempts = 0;

beforeAll(() => {
  vi.stubEnv("ENABLE_TEAM_MODE", "true");
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    if (input !== "https://openrouter.ai/api/v1/chat/completions" || init?.method !== "POST") {
      throw new Error("Preview verification only permits requests to OpenRouter chat completions.");
    }
    const { model } = JSON.parse(String(init.body)) as { model: string };
    if (!allowed.has(model) || !model.endsWith(":free") || attempts >= 6) {
      throw new Error("Unexpected model or request count in Preview verification.");
    }
    attempts += 1;
    const response = await fetchFromOpenRouter(input, { ...init, redirect: "error" });
    providerCalls.push({ model, status: response.status });
    return response;
  });
});

afterAll(() => {
  console.log("[stage8] " + JSON.stringify({ attempts, providerCalls }));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function modelRow(key: string, active = true) {
  return {
    id: crypto.randomUUID(), model_key: key, display_name: key, provider: "openrouter",
    is_active: active, is_public: active, price_label: "free", access_level: "anonymous",
  };
}

function makeRequest(path: string, data: object) {
  return new NextRequest("http://localhost" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

const judgeBody = {
  prompt: "Add 7 and 5 and give the result as an integer.",
  responses: [
    { modelId: "fixture-correct", modelName: "First", answerText: "12" },
    { modelId: "fixture-incorrect", modelName: "Second", answerText: "13" },
  ],
};

it.each([
  { label: "primary", primaryActive: true, expectedModel: JUDGE_PRIMARY_MODEL_ID },
  { label: "fallback", primaryActive: false, expectedModel: JUDGE_FALLBACK_MODEL_ID },
])("Judge $label returns a correct verdict with both scores", async ({ label, primaryActive, expectedModel }) => {
  state.models = [modelRow(JUDGE_PRIMARY_MODEL_ID, primaryActive), modelRow(JUDGE_FALLBACK_MODEL_ID)];
  const started = performance.now();
  const response = await judge(makeRequest("/api/judge", judgeBody));
  const body = await response.json();
  console.log("[stage8] " + JSON.stringify({ flow: "Judge " + label, http: response.status,
    model: providerCalls.at(-1)?.model, ms: Math.round(performance.now() - started),
    verdict: body.status === "ok" && body.verdict?.winnerModelId === "fixture-correct",
    scores: Object.keys(body.verdict?.scores ?? {}).length, errorCode: body.errorCode,
  }));

  expect(response.status).toBe(200);
  expect(body.verdict.winnerModelId).toBe("fixture-correct");
  expect(Object.keys(body.verdict.scores).sort()).toEqual(["fixture-correct", "fixture-incorrect"]);
  expect(providerCalls.at(-1)).toEqual({ model: expectedModel, status: 200 });
}, 30_000);

it("Team uses one live model and completes every role", async () => {
  state.models = [modelRow(TEAM_DEFAULT_MODEL_ID), modelRow("google/gemma-4-26b-a4b-it:free", false)];
  const started = performance.now();
  const countBefore = providerCalls.length;
  const response = await team(makeRequest("/api/team-run", {
    task: "Outline a short checklist for organizing three books on a shelf.",
    modelId: "google/gemma-4-26b-a4b-it:free",
  }));
  const body = await response.json();
  const roles = body.steps?.map((step: { roleId: string }) => step.roleId);
  const elapsed = Math.round(performance.now() - started);
  console.log("[stage8] " + JSON.stringify({ flow: "AI Team", http: response.status,
    model: providerCalls.at(-1)?.model, ms: elapsed, roles, errorCode: body.errorCode,
  }));

  expect(response.status).toBe(200);
  expect(roles).toEqual(["planner", "researcher", "critic", "finalizer"]);
  expect(body.steps.every((step: { output: string }) => step.output.trim().length > 0)).toBe(true);
  expect(body.finalAnswer.trim().length).toBeGreaterThan(0);
  expect(providerCalls.slice(countBefore)).toEqual(Array(4).fill({ model: TEAM_DEFAULT_MODEL_ID, status: 200 }));
  expect(elapsed).toBeLessThan(60_000);
  expect(state.saveArenaRun).toHaveBeenCalledTimes(1);
}, 65_000);
