import { describe, expect, it, vi } from "vitest";
import { loadOpenRouterIntegrationStatus } from "./openrouter-integration-loader";

function asFetch(
  implementation: () => Promise<Response>
): typeof fetch {
  return vi.fn(implementation) as unknown as typeof fetch;
}

describe("loadOpenRouterIntegrationStatus", () => {
  it("returns safe integration state for a successful response", async () => {
    const fetchImpl = asFetch(async () =>
      new Response(
        JSON.stringify({
          status: "success",
          enabled: true,
          integration: {
            connected: true,
            safeFingerprint: "12345678…abcd",
            lastVerifiedAt: "2026-09-29T00:00:00.000Z",
            fundingSource: "user_openrouter",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(
      loadOpenRouterIntegrationStatus(fetchImpl)
    ).resolves.toEqual({
      kind: "success",
      enabled: true,
      integration: {
        connected: true,
        safeFingerprint: "12345678…abcd",
        lastVerifiedAt: "2026-09-29T00:00:00.000Z",
        fundingSource: "user_openrouter",
      },
    });
  });

  it("surfaces an enabled-beta persistence failure instead of hiding the integration", async () => {
    const fetchImpl = asFetch(async () =>
      new Response(
        JSON.stringify({
          status: "error",
          errorCode: "OPENROUTER_CREDENTIAL_STORE_FAILED",
          message: "Could not read OpenRouter connection status.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(
      loadOpenRouterIntegrationStatus(fetchImpl)
    ).resolves.toEqual({
      kind: "error",
      message: "Could not read OpenRouter connection status.",
    });
  });

  it("returns a retryable safe error for network failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network failed");
    }) as unknown as typeof fetch;

    const result = await loadOpenRouterIntegrationStatus(fetchImpl);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("Повторите попытку");
      expect(result.message).not.toContain("network failed");
    }
  });

  it("rejects malformed success payloads", async () => {
    const fetchImpl = asFetch(async () =>
      new Response(
        JSON.stringify({
          status: "success",
          enabled: true,
          integration: {
            connected: "yes",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const result = await loadOpenRouterIntegrationStatus(fetchImpl);
    expect(result.kind).toBe("error");
  });
});
