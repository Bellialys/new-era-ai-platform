import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getAuthenticatedUserIdMock,
  getIntegrationStatusMock,
  isOAuthBetaAvailableMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
  getIntegrationStatusMock: vi.fn(),
  isOAuthBetaAvailableMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getAuthenticatedUserId: getAuthenticatedUserIdMock,
    logApiRequest: vi.fn(),
  };
});

vi.mock("@/lib/server/openrouter-credentials", () => {
  class OpenRouterCredentialError extends Error {}
  return {
    OpenRouterCredentialError,
    getOpenRouterIntegrationStatus: getIntegrationStatusMock,
    disconnectOpenRouterCredential: vi.fn(),
  };
});

vi.mock("@/lib/server/openrouter-integration-config", () => ({
  isOpenRouterOAuthBetaAvailable: isOAuthBetaAvailableMock,
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseServerClient: () => ({ kind: "supabase" }),
}));

import { GET } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INTERNAL_CREDENTIAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  getAuthenticatedUserIdMock.mockReset();
  getIntegrationStatusMock.mockReset();
  isOAuthBetaAvailableMock.mockReset();

  getAuthenticatedUserIdMock.mockResolvedValue(USER_ID);
  isOAuthBetaAvailableMock.mockReturnValue(true);
  getIntegrationStatusMock.mockResolvedValue({
    connected: true,
    credentialId: INTERNAL_CREDENTIAL_ID,
    credentialStatus: "active",
    safeFingerprint: "12345678…abcd",
    lastVerifiedAt: "2026-09-29T00:00:00.000Z",
    fundingSource: "user_openrouter",
  });
});

describe("GET /api/integrations/openrouter", () => {
  it("returns only safe browser-facing integration metadata", async () => {
    const response = await GET(
      new NextRequest("https://new-era.example/api/integrations/openrouter")
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      status: "success",
      enabled: true,
      integration: {
        connected: true,
        safeFingerprint: "12345678…abcd",
        lastVerifiedAt: "2026-09-29T00:00:00.000Z",
        fundingSource: "user_openrouter",
      },
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(INTERNAL_CREDENTIAL_ID);
    expect(serialized).not.toContain("credentialId");
    expect(serialized).not.toContain("credentialStatus");
  });
});
