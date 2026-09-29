import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseMock, fromMock, insertMock } = vi.hoisted(() => ({
  getSupabaseMock: vi.fn(),
  fromMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("./supabase", () => ({
  getSupabaseServerClient: getSupabaseMock,
}));

import { recordOpenRouterUsageEventBestEffort } from "./openrouter-usage";

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockReset().mockReturnValue({ insert: insertMock });
  getSupabaseMock.mockReset().mockReturnValue({ from: fromMock });
});

describe("recordOpenRouterUsageEventBestEffort", () => {
  it("stores provider-reported cost and routing metadata per provider call", async () => {
    await recordOpenRouterUsageEventBestEffort({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      guestId: null,
      modeSlug: "prompt-arena",
      requestKind: "text",
      modelKey: "requested/model",
      billingSource: "platform",
      credentialId: null,
      latencyMs: 42,
      errorCode: null,
      result: {
        text: "ok",
        latencyMs: 41,
        providerRequestId: "gen-123",
        providerModelId: "provider/actual-model",
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          costUsd: 0.0025,
          costSource: "provider_usage",
          providerIsByok: true,
        },
      },
    });

    expect(fromMock).toHaveBeenCalledWith("usage_events");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        mode_slug: "prompt-arena",
        model_key: "requested/model",
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        latency_ms: 41,
        cost_usd: 0.0025,
        billing_source: "platform",
        provider_request_id: "gen-123",
        provider_model_key: "provider/actual-model",
        provider_is_byok: true,
        cost_source: "provider_usage",
        currency: "USD",
        request_kind: "text",
      })
    );
  });

  it("never turns telemetry failure into inference failure", async () => {
    insertMock.mockRejectedValue(new Error("database unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordOpenRouterUsageEventBestEffort({
        userId: null,
        guestId: "guest-1",
        modeSlug: "prompt-arena",
        requestKind: "stream",
        modelKey: "requested/model",
        billingSource: "platform",
        credentialId: null,
        result: null,
        latencyMs: 50,
        errorCode: "NETWORK_ERROR",
      })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
  });

  it("bounds a telemetry write that never settles", async () => {
    vi.useFakeTimers();
    insertMock.mockReturnValue(new Promise(() => {}));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const pending = recordOpenRouterUsageEventBestEffort({
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        guestId: null,
        modeSlug: "prompt-arena",
        requestKind: "text",
        modelKey: "requested/model",
        billingSource: "platform",
        credentialId: null,
        result: null,
        latencyMs: 25,
        errorCode: null,
      });

      await vi.advanceTimersByTimeAsync(1_500);
      await expect(pending).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips writes when Supabase is not configured", async () => {
    getSupabaseMock.mockReturnValue(null);

    await recordOpenRouterUsageEventBestEffort({
      userId: null,
      guestId: "guest-1",
      modeSlug: "prompt-arena",
      requestKind: "text",
      modelKey: "requested/model",
      billingSource: "platform",
      credentialId: null,
      result: null,
      latencyMs: 10,
      errorCode: "PROVIDER_ERROR",
    });

    expect(fromMock).not.toHaveBeenCalled();
  });
});
