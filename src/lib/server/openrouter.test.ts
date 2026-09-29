import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchOpenRouterResponse,
  fetchOpenRouterResponseWithApiKey,
  streamOpenRouterResponse,
  streamOpenRouterResponseWithApiKey,
} from "./openrouter";

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://new-era.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenRouter provider usage contract", () => {
  it("requests provider usage and returns actual cost/provider metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "gen-123",
          object: "chat.completion",
          created: 1,
          model: "provider/actual-model",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "  Result text  " },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 7,
            total_tokens: 19,
            cost: 0.00125,
            is_byok: true,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchOpenRouterResponse(
      "hello",
      "requested/model",
      { systemPrompt: "system" }
    );

    expect(result).toMatchObject({
      text: "Result text",
      providerRequestId: "gen-123",
      providerModelId: "provider/actual-model",
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
        costUsd: 0.00125,
        costSource: "provider_usage",
        providerIsByok: true,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "requested/model",
      usage: { include: true },
    });
  });

  it("never labels a missing or invalid provider cost as actual", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "gen-unknown-cost",
          object: "chat.completion",
          created: 1,
          model: "requested/model",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "ok" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 3,
            completion_tokens: 2,
            total_tokens: 5,
            cost: -1,
            is_byok: "unexpected",
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchOpenRouterResponse("hello", "requested/model");

    expect(result.usage).toEqual({
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
      costUsd: null,
      costSource: "unknown",
      providerIsByok: null,
    });
  });

  it("captures usage, actual model and request id from a stream", async () => {
    const streamPayload = [
      'data: {"id":"gen-stream","model":"provider/stream-model","choices":[{"delta":{"content":"Hello "}}]}',
      "",
      'data: {"id":"gen-stream","model":"provider/stream-model","choices":[{"delta":{"content":"world"}}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6,"cost":0,"is_byok":false}}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(streamPayload, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const onToken = vi.fn();

    const result = await streamOpenRouterResponse(
      "hello",
      "requested/model",
      onToken
    );

    expect(onToken).toHaveBeenNthCalledWith(1, "Hello ");
    expect(onToken).toHaveBeenNthCalledWith(2, "world");
    expect(result).toMatchObject({
      text: "Hello world",
      providerRequestId: "gen-stream",
      providerModelId: "provider/stream-model",
      usage: {
        inputTokens: 4,
        outputTokens: 2,
        totalTokens: 6,
        costUsd: 0,
        costSource: "provider_usage",
        providerIsByok: false,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "requested/model",
      stream: true,
      usage: { include: true },
    });
  });
  it("rejects control characters before constructing Authorization headers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchOpenRouterResponseWithApiKey(
        "secret-key\r\nInjected: value",
        "hello",
        "requested/model"
      )
    ).rejects.toMatchObject({
      errorCode: "AI_CREDENTIAL_UNAVAILABLE",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redacts transport errors for explicit credentials", async () => {
    const secret = "super-secret-key";
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error(`Authorization: Bearer ${secret}`));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchOpenRouterResponseWithApiKey(secret, "hello", "requested/model")
    ).rejects.toMatchObject({
      errorCode: "NETWORK_ERROR",
    });

    await expect(
      streamOpenRouterResponseWithApiKey(
        secret,
        "hello",
        "requested/model",
        vi.fn()
      )
    ).rejects.toMatchObject({
      errorCode: "NETWORK_ERROR",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain(secret);
  });

});
