import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithKeyMock, streamWithKeyMock } = vi.hoisted(() => ({
  fetchWithKeyMock: vi.fn(),
  streamWithKeyMock: vi.fn(),
}));

vi.mock("./openrouter", () => ({
  fetchOpenRouterResponseWithApiKey: fetchWithKeyMock,
  streamOpenRouterResponseWithApiKey: streamWithKeyMock,
}));

import {
  executeOpenRouterText,
  OpenRouterGatewayConfigurationError,
  streamOpenRouterText,
} from "./openrouter-gateway";

const providerResult = {
  text: "provider result",
  latencyMs: 42,
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    costUsd: 0.002,
    costSource: "provider_usage" as const,
    providerIsByok: false,
  },
  providerRequestId: "gen-123",
  providerModelId: "provider/actual-model",
};

beforeEach(() => {
  fetchWithKeyMock.mockReset();
  streamWithKeyMock.mockReset();
  fetchWithKeyMock.mockResolvedValue(providerResult);
  streamWithKeyMock.mockResolvedValue(providerResult);
});

describe("OpenRouter unified gateway foundation", () => {
  it("routes a user OpenRouter credential without returning the secret", async () => {
    const result = await executeOpenRouterText({
      prompt: "hello",
      modelId: "requested/model",
      systemPrompt: "system",
      credential: {
        billingSource: "user_openrouter",
        credentialId: " cred-user-1 ",
        apiKey: " user-secret-key ",
      },
    });

    expect(fetchWithKeyMock).toHaveBeenCalledWith(
      "user-secret-key",
      "hello",
      "requested/model",
      { systemPrompt: "system" }
    );
    expect(result).toMatchObject({
      billingSource: "user_openrouter",
      credentialId: "cred-user-1",
      providerRequestId: "gen-123",
      providerModelId: "provider/actual-model",
      usage: providerResult.usage,
    });
    expect(result).not.toHaveProperty("apiKey");
  });

  it("supports the current legacy platform key with no credential id", async () => {
    const result = await executeOpenRouterText({
      prompt: "hello",
      modelId: "requested/model",
      credential: {
        billingSource: "platform",
        credentialId: null,
        apiKey: "platform-secret",
      },
    });

    expect(fetchWithKeyMock).toHaveBeenCalledWith(
      "platform-secret",
      "hello",
      "requested/model",
      undefined
    );
    expect(result.billingSource).toBe("platform");
    expect(result.credentialId).toBeNull();
  });

  it("fails closed when user funding has no persisted credential id", async () => {
    await expect(
      executeOpenRouterText({
        prompt: "hello",
        modelId: "requested/model",
        credential: {
          billingSource: "user_openrouter",
          credentialId: null,
          apiKey: "user-secret",
        },
      })
    ).rejects.toBeInstanceOf(OpenRouterGatewayConfigurationError);

    expect(fetchWithKeyMock).not.toHaveBeenCalled();
  });

  it("fails closed before transport when the resolved credential secret is empty", async () => {
    await expect(
      executeOpenRouterText({
        prompt: "hello",
        modelId: "requested/model",
        credential: {
          billingSource: "platform",
          credentialId: null,
          apiKey: "   ",
        },
      })
    ).rejects.toMatchObject({
      name: "OpenRouterGatewayConfigurationError",
    });

    expect(fetchWithKeyMock).not.toHaveBeenCalled();
  });

  it("rejects header-unsafe credential characters before transport", async () => {
    await expect(
      executeOpenRouterText({
        prompt: "hello",
        modelId: "requested/model",
        credential: {
          billingSource: "user_openrouter",
          credentialId: "cred-user-unsafe",
          apiKey: "secret-key\r\nInjected: value",
        },
      })
    ).rejects.toBeInstanceOf(OpenRouterGatewayConfigurationError);

    expect(fetchWithKeyMock).not.toHaveBeenCalled();
  });

  it("uses the same funding contract for streaming", async () => {
    const onToken = vi.fn();

    const result = await streamOpenRouterText({
      prompt: "stream",
      modelId: "requested/model",
      onToken,
      credential: {
        billingSource: "user_openrouter",
        credentialId: "cred-stream",
        apiKey: "stream-secret",
      },
    });

    expect(streamWithKeyMock).toHaveBeenCalledWith(
      "stream-secret",
      "stream",
      "requested/model",
      onToken,
      undefined
    );
    expect(result).toMatchObject({
      billingSource: "user_openrouter",
      credentialId: "cred-stream",
    });
    expect(result).not.toHaveProperty("apiKey");
  });
});
