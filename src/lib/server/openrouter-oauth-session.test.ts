import { describe, expect, it } from "vitest";
import {
  OPENROUTER_OAUTH_FLOW_TTL_SECONDS,
  OpenRouterOAuthSessionError,
  getOpenRouterOAuthCookieSigningSecret,
  parseOpenRouterOAuthFlow,
  serializeOpenRouterOAuthFlow,
} from "./openrouter-oauth-session";

const userId = "00000000-0000-4000-8000-000000000001";
const secret = "0123456789abcdef0123456789abcdef";
const state = "state_state_state_state_state_state_123456";
const verifier =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

describe("OpenRouter OAuth flow session", () => {
  it("round-trips a signed short-lived verifier without exposing a server secret", () => {
    const cookie = serializeOpenRouterOAuthFlow({
      userId,
      state,
      codeVerifier: verifier,
      signingSecret: secret,
      nowMs: 1_000_000,
    });

    expect(cookie).not.toContain(secret);

    expect(
      parseOpenRouterOAuthFlow({
        cookieValue: cookie,
        signingSecret: secret,
        expectedUserId: userId,
        nowMs: 1_000_100,
      })
    ).toMatchObject({
      userId,
      state,
      codeVerifier: verifier,
      issuedAt: 1_000_000,
    });
  });

  it("rejects tampering and a different authenticated user", () => {
    const cookie = serializeOpenRouterOAuthFlow({
      userId,
      state,
      codeVerifier: verifier,
      signingSecret: secret,
      nowMs: 1_000_000,
    });

    expect(() =>
      parseOpenRouterOAuthFlow({
        cookieValue: `${cookie.slice(0, -1)}x`,
        signingSecret: secret,
        expectedUserId: userId,
        nowMs: 1_000_100,
      })
    ).toThrow(OpenRouterOAuthSessionError);

    expect(() =>
      parseOpenRouterOAuthFlow({
        cookieValue: cookie,
        signingSecret: secret,
        expectedUserId: "00000000-0000-4000-8000-000000000002",
        nowMs: 1_000_100,
      })
    ).toThrow("does not match the current user");
  });

  it("expires after the OAuth authorization-code window", () => {
    const cookie = serializeOpenRouterOAuthFlow({
      userId,
      state,
      codeVerifier: verifier,
      signingSecret: secret,
      nowMs: 1_000_000,
    });

    expect(() =>
      parseOpenRouterOAuthFlow({
        cookieValue: cookie,
        signingSecret: secret,
        expectedUserId: userId,
        nowMs:
          1_000_000 + OPENROUTER_OAUTH_FLOW_TTL_SECONDS * 1000 + 1,
      })
    ).toThrow("expired");
  });

  it("requires a dedicated signing secret with at least 32 bytes", () => {
    expect(() =>
      getOpenRouterOAuthCookieSigningSecret({
        OPENROUTER_OAUTH_COOKIE_SECRET: "too-short",
      })
    ).toThrow("at least 32 bytes");

    expect(
      getOpenRouterOAuthCookieSigningSecret({
        OPENROUTER_OAUTH_COOKIE_SECRET: secret,
      })
    ).toBe(secret);
  });
});
