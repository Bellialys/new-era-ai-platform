import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  requireOpenRouterOAuthBetaAvailable,
  requireSameOriginMutation,
} from "./openrouter-integration-security";

describe("OpenRouter integration security", () => {
  it("accepts same-origin mutations and rejects cross-origin or missing Origin", () => {
    const sameOrigin = new NextRequest(
      "https://new-era.example/api/integrations/openrouter/connect",
      {
        method: "POST",
        headers: { Origin: "https://new-era.example" },
      }
    );
    expect(() => requireSameOriginMutation(sameOrigin)).not.toThrow();

    const crossOrigin = new NextRequest(
      "https://new-era.example/api/integrations/openrouter/connect",
      {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }
    );
    expect(() => requireSameOriginMutation(crossOrigin)).toThrow(
      "Cross-origin request rejected"
    );

    const missingOrigin = new NextRequest(
      "https://new-era.example/api/integrations/openrouter/connect",
      { method: "POST" }
    );
    expect(() => requireSameOriginMutation(missingOrigin)).toThrow(
      "Request origin is required"
    );
  });

  it("fails closed unless both beta gates are enabled", () => {
    expect(() =>
      requireOpenRouterOAuthBetaAvailable({})
    ).toThrow("not enabled");

    expect(() =>
      requireOpenRouterOAuthBetaAvailable({
        ENABLE_OPENROUTER_USER_OAUTH: "true",
        ENABLE_PROVIDER_CREDENTIAL_PERSISTENCE: "true",
      })
    ).not.toThrow();
  });
});
