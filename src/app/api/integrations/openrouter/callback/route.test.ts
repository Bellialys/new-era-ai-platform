import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getAuthenticatedUserIdMock,
  exchangeAuthorizationCodeMock,
  parseOAuthFlowMock,
  persistCredentialMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
  exchangeAuthorizationCodeMock: vi.fn(),
  parseOAuthFlowMock: vi.fn(),
  persistCredentialMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getAuthenticatedUserId: getAuthenticatedUserIdMock,
    logApiRequest: vi.fn(),
  };
});

vi.mock("@/lib/server/openrouter-oauth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/openrouter-oauth")>();
  return {
    ...actual,
    exchangeOpenRouterAuthorizationCode: exchangeAuthorizationCodeMock,
  };
});

vi.mock("@/lib/server/openrouter-oauth-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/openrouter-oauth-session")>();
  return {
    ...actual,
    getOpenRouterOAuthCookieSigningSecret: () =>
      "0123456789abcdef0123456789abcdef",
    parseOpenRouterOAuthFlow: parseOAuthFlowMock,
  };
});

vi.mock("@/lib/server/openrouter-credentials", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/openrouter-credentials")>();
  return {
    ...actual,
    persistOpenRouterOAuthCredential: persistCredentialMock,
  };
});

vi.mock("@/lib/server/openrouter-integration-security", () => ({
  requireOpenRouterOAuthBetaAvailable: vi.fn(),
}));

vi.mock("@/lib/server/aws-kms-data-key-provider", () => ({
  createAwsKmsDataKeyProviderFromEnv: () => ({ kind: "kms-provider" }),
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseServerClient: () => ({ kind: "supabase" }),
}));

import { GET } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STATE = "state_state_state_state_state_state_123456";
const SENTINEL_KEY = "sk-or-v1-SENTINEL-MUST-NEVER-LEAVE-SERVER";

function makeRequest(): NextRequest {
  return new NextRequest(
    `https://new-era.example/api/integrations/openrouter/callback?code=provider-code&state=${STATE}`,
    {
      headers: {
        Cookie: "na_openrouter_oauth=signed-flow-cookie",
      },
    }
  );
}

beforeEach(() => {
  getAuthenticatedUserIdMock.mockReset();
  exchangeAuthorizationCodeMock.mockReset();
  parseOAuthFlowMock.mockReset();
  persistCredentialMock.mockReset();

  getAuthenticatedUserIdMock.mockResolvedValue(USER_ID);
  parseOAuthFlowMock.mockReturnValue({
    userId: USER_ID,
    state: STATE,
    codeVerifier:
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
    issuedAt: Date.now(),
  });
  exchangeAuthorizationCodeMock.mockResolvedValue(SENTINEL_KEY);
  persistCredentialMock.mockResolvedValue({
    credentialId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    safeFingerprint: "12345678…abcd",
    fundingSource: "user_openrouter",
  });
});

describe("GET /api/integrations/openrouter/callback", () => {
  it("uses the exchanged provider key only server-side and never returns it", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://new-era.example/profile?openrouter=connected"
    );
    expect(persistCredentialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        apiKey: SENTINEL_KEY,
      })
    );

    const body = await response.text();
    const exposedSurface = [
      response.url,
      body,
      ...Array.from(response.headers.entries()).flat(),
    ].join("\n");

    expect(exposedSurface).not.toContain(SENTINEL_KEY);
    expect(exposedSurface).not.toContain("sk-or-v1-SENTINEL");
  });
});
