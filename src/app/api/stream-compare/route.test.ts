import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  resolveIdentityMock,
  checkDailyLimitMock,
  checkRateLimitMock,
  resolveSelectedModelsMock,
  saveArenaRunMock,
  getApiKeyMock,
  fetchMock,
} = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkDailyLimitMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  resolveSelectedModelsMock: vi.fn(),
  saveArenaRunMock: vi.fn(),
  getApiKeyMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkDailyLimit: checkDailyLimitMock,
    checkRateLimit: checkRateLimitMock,
    resolveSelectedModels: resolveSelectedModelsMock,
    saveArenaRun: saveArenaRunMock,
    getApiKey: getApiKeyMock,
    logApiRequest: vi.fn(),
  };
});

import { POST } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VALID_PROMPT = "Compare these models for a concise writing task.";
const MODEL_A = {
  selectionId: "model-a-id",
  modelId: "db-model-a",
  modelKey: "provider/model-a",
  name: "Real Model A",
  role: "assistant",
};
const MODEL_B = {
  selectionId: "model-b-id",
  modelId: "db-model-b",
  modelKey: "provider/model-b",
  name: "Real Model B",
  role: "assistant",
};

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/stream-compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: VALID_PROMPT,
      modelIds: [MODEL_A.selectionId, MODEL_B.selectionId],
      modeSlug: "prompt-arena",
      ...body,
    }),
  });
}

function openRouterResponse(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          [
            'data: {"choices":[{"delta":{"content":"hello "}}]}',
            'data: {"choices":[{"delta":{"content":"world"}}],"usage":{"prompt_tokens":1,"completion_tokens":2}}',
            "data: [DONE]",
            "",
          ].join("\n")
        )
      );
      controller.close();
    },
  });

  return new Response(stream, { status: 200 });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resolveIdentityMock.mockReset();
  checkDailyLimitMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveSelectedModelsMock.mockReset();
  saveArenaRunMock.mockReset();
  getApiKeyMock.mockReset();

  fetchMock.mockImplementation(() => Promise.resolve(openRouterResponse()));
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkDailyLimitMock.mockResolvedValue({ allowed: true, used: 1, limit: 100 });
  checkRateLimitMock.mockResolvedValue({ limited: false, remaining: 9, resetAt: Date.now() + 60_000 });
  resolveSelectedModelsMock.mockResolvedValue([MODEL_A, MODEL_B]);
  saveArenaRunMock.mockResolvedValue({
    taskId: "11111111-1111-4111-8111-111111111111",
    responseIdsByModelId: {
      [MODEL_A.selectionId]: "22222222-2222-4222-8222-222222222222",
      [MODEL_B.selectionId]: "33333333-3333-4333-8333-333333333333",
    },
  });
  getApiKeyMock.mockReturnValue("test-openrouter-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/stream-compare blind mode", () => {
  it("streams only slot identity while persisting real model identity", async () => {
    const response = await POST(makeRequest({ blind: true }));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(text).toContain("slot-a");
    expect(text).toContain("slot-b");
    expect(text).toContain("Модель A");
    expect(text).toContain("Модель B");
    expect(text).not.toContain(MODEL_A.name);
    expect(text).not.toContain(MODEL_B.name);
    expect(text).not.toContain(MODEL_A.modelKey);
    expect(text).not.toContain(MODEL_B.modelKey);
    expect(text).toContain("22222222-2222-4222-8222-222222222222");
    expect(text).toContain("33333333-3333-4333-8333-333333333333");

    expect(saveArenaRunMock).toHaveBeenCalledTimes(1);
    const [[saveInput]] = saveArenaRunMock.mock.calls as [[{
      isBlind?: boolean;
      modelKeys: string[];
      responses: Array<{ modelId: string; modelKey: string; modelName: string; answerText: string | null }>;
    }]];
    expect(saveInput.isBlind).toBe(true);
    expect([...saveInput.modelKeys].sort()).toEqual([MODEL_A.modelKey, MODEL_B.modelKey].sort());
    expect(saveInput.responses.map((item) => item.modelName).sort()).toEqual([
      MODEL_A.name,
      MODEL_B.name,
    ]);
    expect(saveInput.responses.map((item) => item.modelKey).sort()).toEqual([
      MODEL_A.modelKey,
      MODEL_B.modelKey,
    ]);
  });

  it("streams real display names when blind mode is not requested", async () => {
    const response = await POST(makeRequest({}));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain(MODEL_A.name);
    expect(text).toContain(MODEL_B.name);
    expect(text).not.toContain("slot-a");
    expect(saveArenaRunMock).toHaveBeenCalledTimes(1);
    const [[saveInput]] = saveArenaRunMock.mock.calls as [[{ isBlind?: boolean }]];
    expect(saveInput.isBlind).toBe(false);
  });

  it("sets Secure on refreshed guest cookies in production streams", async () => {
    vi.stubEnv("NODE_ENV", "production");
    resolveIdentityMock.mockResolvedValue({
      kind: "guest",
      userId: null,
      guestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    const response = await POST(makeRequest({}));
    await response.text();

    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("na_guest=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("does not stream raw provider exception messages to the browser", async () => {
    fetchMock.mockRejectedValue(new Error("provider trace with secret-token=abc123"));

    const response = await POST(makeRequest({}));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("Model response failed. Please try again.");
    expect(text).not.toContain("secret-token=abc123");
    expect(text).not.toContain("provider trace");
  });
});
