import { describe, expect, it } from "vitest";
import type { OpenRouterGatewayResult } from "./openrouter-gateway";
import {
  OpenRouterUsageContractError,
  toOpenRouterUsageEvent,
} from "./openrouter-usage";

const gatewayResult: OpenRouterGatewayResult = {
  text: "answer",
  latencyMs: 123,
  usage: {
    inputTokens: 10,
    outputTokens: 4,
    totalTokens: 14,
    costUsd: 0.0015,
    costSource: "provider_usage",
    providerIsByok: false,
  },
  providerRequestId: "gen-123",
  providerModelId: "provider/actual-model",
  billingSource: "user_openrouter",
  credentialId: "credential-123",
};

describe("OpenRouter usage event contract", () => {
  it("maps provider-reported usage without confusing requested and actual models", () => {
    const event = toOpenRouterUsageEvent({
      userId: "user-1",
      guestId: null,
      modeSlug: "prompt-arena",
      requestKind: "text",
      requestedModelId: "requested/model",
      result: gatewayResult,
    });

    expect(event).toEqual({
      userId: "user-1",
      guestId: null,
      modeSlug: "prompt-arena",
      modelKey: "requested/model",
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
      latencyMs: 123,
      costUsd: 0.0015,
      errorCode: null,
      billingSource: "user_openrouter",
      credentialId: "credential-123",
      providerRequestId: "gen-123",
      providerModelId: "provider/actual-model",
      providerUsage: {
        promptTokens: 10,
        completionTokens: 4,
        totalTokens: 14,
        costUsd: 0.0015,
        costSource: "provider_usage",
        providerIsByok: false,
      },
      providerIsByok: false,
      costSource: "provider_usage",
      currency: "USD",
      requestKind: "text",
    });
  });

  it("preserves unknown cost as unknown instead of inventing an estimate", () => {
    const event = toOpenRouterUsageEvent({
      userId: null,
      guestId: "guest-1",
      modeSlug: "code-arena",
      requestKind: "text",
      requestedModelId: "requested/model",
      result: {
        ...gatewayResult,
        billingSource: "platform",
        credentialId: null,
        usage: {
          ...gatewayResult.usage,
          costUsd: null,
          costSource: "unknown",
          providerIsByok: null,
        },
      },
    });

    expect(event.costUsd).toBeNull();
    expect(event.costSource).toBe("unknown");
    expect(event.providerUsage.costUsd).toBeNull();
    expect(event.providerUsage.costSource).toBe("unknown");
  });

  it("fails closed on contradictory cost metadata", () => {
    expect(() =>
      toOpenRouterUsageEvent({
        userId: "user-1",
        guestId: null,
        modeSlug: "judge",
        requestKind: "text",
        requestedModelId: "requested/model",
        result: {
          ...gatewayResult,
          usage: {
            ...gatewayResult.usage,
            costUsd: null,
            costSource: "provider_usage",
          },
        },
      })
    ).toThrow(OpenRouterUsageContractError);

    expect(() =>
      toOpenRouterUsageEvent({
        userId: "user-1",
        guestId: null,
        modeSlug: "judge",
        requestKind: "text",
        requestedModelId: "requested/model",
        result: {
          ...gatewayResult,
          usage: {
            ...gatewayResult.usage,
            costUsd: 0.25,
            costSource: "unknown",
          },
        },
      })
    ).toThrow(OpenRouterUsageContractError);
  });

  it("is allowlist-based and cannot serialize an accidental API key property", () => {
    const sourceWithSecret = {
      ...gatewayResult,
      apiKey: "must-never-enter-telemetry",
    } as OpenRouterGatewayResult & { apiKey: string };

    const event = toOpenRouterUsageEvent({
      userId: "user-1",
      guestId: null,
      modeSlug: "team",
      requestKind: "text",
      requestedModelId: "requested/model",
      result: sourceWithSecret,
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("must-never-enter-telemetry");
    expect(serialized).not.toContain("apiKey");
  });

  it("rejects empty telemetry dimensions before persistence", () => {
    expect(() =>
      toOpenRouterUsageEvent({
        userId: "user-1",
        guestId: null,
        modeSlug: "   ",
        requestKind: "text",
        requestedModelId: "requested/model",
        result: gatewayResult,
      })
    ).toThrow("modeSlug is required.");
  });
});
