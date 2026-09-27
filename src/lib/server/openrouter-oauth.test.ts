import { describe, expect, it, vi } from "vitest";
import {
  OPENROUTER_AUTH_KEYS_URL,
  buildOpenRouterAuthorizationUrl,
  createOpenRouterPkceSession,
  createS256Challenge,
  exchangeOpenRouterAuthorizationCode,
  oauthStateMatches,
} from "./openrouter-oauth";

describe("OpenRouter OAuth PKCE", () => {
  it("creates verifier, S256 challenge, and independent state", () => {
    const session = createOpenRouterPkceSession();

    expect(session.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(session.codeChallenge).toBe(createS256Challenge(session.codeVerifier));
    expect(session.state).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(session.state).not.toBe(session.codeVerifier);
  });

  it("builds an S256 authorization URL with callback and state", () => {
    const url = new URL(
      buildOpenRouterAuthorizationUrl({
        callbackUrl: "https://example.com/api/integrations/openrouter/callback",
        codeChallenge: "challenge",
        state: "state-value",
      })
    );

    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(url.searchParams.get("callback_url")).toBe(
      "https://example.com/api/integrations/openrouter/callback"
    );
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("state-value");
  });

  it("rejects insecure non-localhost callback URLs", () => {
    expect(() =>
      buildOpenRouterAuthorizationUrl({
        callbackUrl: "http://example.com/callback",
        codeChallenge: "challenge",
        state: "state-value",
      })
    ).toThrow("OAuth callback must use HTTPS");
  });

  it("compares callback state safely", () => {
    expect(oauthStateMatches("same-state", "same-state")).toBe(true);
    expect(oauthStateMatches("same-state", "other-state")).toBe(false);
    expect(oauthStateMatches("same-state", null)).toBe(false);
  });

  it("exchanges authorization code without sending an Authorization header", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      expect(JSON.parse(String(init?.body))).toEqual({
        code: "oauth-code",
        code_verifier: "verifier",
        code_challenge_method: "S256",
      });
      return new Response(JSON.stringify({ key: "user-controlled-key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await expect(
      exchangeOpenRouterAuthorizationCode({
        code: "oauth-code",
        codeVerifier: "verifier",
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).resolves.toBe("user-controlled-key");

    expect(fetchImpl).toHaveBeenCalledWith(
      OPENROUTER_AUTH_KEYS_URL,
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("fails closed on rejected or malformed exchanges", async () => {
    const rejected = vi.fn(async () => new Response("forbidden", { status: 403 }));
    await expect(
      exchangeOpenRouterAuthorizationCode({
        code: "oauth-code",
        codeVerifier: "verifier",
        fetchImpl: rejected as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "OAUTH_EXCHANGE_FAILED" });

    const malformed = vi.fn(
      async () =>
        new Response(JSON.stringify({ no_key: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    await expect(
      exchangeOpenRouterAuthorizationCode({
        code: "oauth-code",
        codeVerifier: "verifier",
        fetchImpl: malformed as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "OAUTH_INVALID_RESPONSE" });
  });
});
