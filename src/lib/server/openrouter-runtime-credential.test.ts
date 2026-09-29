import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  oauthAvailableMock,
  getSupabaseMock,
  resolveFundingMock,
  getApiKeyMock,
  decryptMock,
  createKmsMock,
} = vi.hoisted(() => ({
  oauthAvailableMock: vi.fn(),
  getSupabaseMock: vi.fn(),
  resolveFundingMock: vi.fn(),
  getApiKeyMock: vi.fn(),
  decryptMock: vi.fn(),
  createKmsMock: vi.fn(),
}));

vi.mock("./openrouter-integration-config", () => ({
  isOpenRouterOAuthBetaAvailable: oauthAvailableMock,
}));

vi.mock("./supabase", () => ({
  getSupabaseServerClient: getSupabaseMock,
}));

vi.mock("./funding-resolver", () => ({
  resolveAiFunding: resolveFundingMock,
}));

vi.mock("./openrouter", () => ({
  getApiKey: getApiKeyMock,
}));

vi.mock("./credential-crypto", () => ({
  decryptCredentialSecret: decryptMock,
}));

vi.mock("./aws-kms-data-key-provider", () => ({
  createAwsKmsDataKeyProviderFromEnv: createKmsMock,
}));

import { resolveOpenRouterRuntimeCredential } from "./openrouter-runtime-credential";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREDENTIAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER = { kind: "user", userId: USER_ID, guestId: null } as const;
const GUEST = {
  kind: "guest",
  userId: null,
  guestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
} as const;

function credentialQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const chain = vi.fn(() => query);
  query.select = chain;
  query.eq = chain;
  query.maybeSingle = vi.fn(async () => result);
  return query;
}

beforeEach(() => {
  oauthAvailableMock.mockReset().mockReturnValue(true);
  getSupabaseMock.mockReset();
  resolveFundingMock.mockReset();
  getApiKeyMock.mockReset().mockReturnValue("platform-key");
  decryptMock.mockReset().mockResolvedValue("user-openrouter-key");
  createKmsMock.mockReset().mockReturnValue({ decryptDataKey: vi.fn() });
});

describe("resolveOpenRouterRuntimeCredential", () => {
  it("uses the platform credential while the OAuth rollout flags are disabled", async () => {
    oauthAvailableMock.mockReturnValue(false);

    await expect(resolveOpenRouterRuntimeCredential(USER)).resolves.toEqual({
      billingSource: "platform",
      credentialId: null,
      apiKey: "platform-key",
    });

    expect(getSupabaseMock).not.toHaveBeenCalled();
    expect(decryptMock).not.toHaveBeenCalled();
  });

  it("keeps guest traffic on the platform credential", async () => {
    await expect(resolveOpenRouterRuntimeCredential(GUEST)).resolves.toEqual({
      billingSource: "platform",
      credentialId: null,
      apiKey: "platform-key",
    });

    expect(getSupabaseMock).not.toHaveBeenCalled();
  });

  it("uses platform funding when the authenticated user has no user-funded preference", async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    getSupabaseMock.mockReturnValue(supabase);
    resolveFundingMock.mockResolvedValue({
      billingSource: "platform",
      credentialId: null,
    });

    await expect(resolveOpenRouterRuntimeCredential(USER)).resolves.toEqual({
      billingSource: "platform",
      credentialId: null,
      apiKey: "platform-key",
    });

    expect(decryptMock).not.toHaveBeenCalled();
  });

  it("decrypts only the active credential selected by the server funding resolver", async () => {
    const query = credentialQuery({
      data: {
        id: CREDENTIAL_ID,
        secret_ciphertext: "\\x010203",
        encrypted_dek: "\\x0a0b0c",
        kms_key_id: "kms-user-key",
        encryption_version: 1,
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);
    getSupabaseMock.mockReturnValue({ from } as unknown as SupabaseClient);
    resolveFundingMock.mockResolvedValue({
      billingSource: "user_openrouter",
      credentialId: CREDENTIAL_ID,
    });

    await expect(resolveOpenRouterRuntimeCredential(USER)).resolves.toEqual({
      billingSource: "user_openrouter",
      credentialId: CREDENTIAL_ID,
      apiKey: "user-openrouter-key",
    });

    expect(from).toHaveBeenCalledWith("provider_credentials");
    expect(decryptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: new Uint8Array([1, 2, 3]),
        encryptedDek: new Uint8Array([10, 11, 12]),
        kmsKeyId: "kms-user-key",
        encryptionVersion: 1,
      }),
      expect.anything(),
      {
        credentialId: CREDENTIAL_ID,
        provider: "openrouter",
        origin: "user_oauth",
      }
    );
  });

  it("fails closed when the persisted envelope is malformed", async () => {
    const query = credentialQuery({
      data: {
        id: CREDENTIAL_ID,
        secret_ciphertext: "not-bytea",
        encrypted_dek: "\\x0a0b",
        kms_key_id: "kms-user-key",
        encryption_version: 1,
      },
      error: null,
    });
    getSupabaseMock.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient);
    resolveFundingMock.mockResolvedValue({
      billingSource: "user_openrouter",
      credentialId: CREDENTIAL_ID,
    });

    await expect(resolveOpenRouterRuntimeCredential(USER)).rejects.toMatchObject({
      errorCode: "AI_CREDENTIAL_UNAVAILABLE",
      statusCode: 503,
    });
    expect(decryptMock).not.toHaveBeenCalled();
  });

  it("never falls back to the platform key when KMS decryption fails", async () => {
    const query = credentialQuery({
      data: {
        id: CREDENTIAL_ID,
        secret_ciphertext: "\\x010203",
        encrypted_dek: "\\x0a0b",
        kms_key_id: "kms-user-key",
        encryption_version: 1,
      },
      error: null,
    });
    getSupabaseMock.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient);
    resolveFundingMock.mockResolvedValue({
      billingSource: "user_openrouter",
      credentialId: CREDENTIAL_ID,
    });
    decryptMock.mockRejectedValue(new Error("kms unavailable"));

    await expect(resolveOpenRouterRuntimeCredential(USER)).rejects.toMatchObject({
      errorCode: "AI_CREDENTIAL_UNAVAILABLE",
    });

    expect(getApiKeyMock).not.toHaveBeenCalled();
  });

  it("fails closed if persistence is unavailable after rollout is enabled", async () => {
    getSupabaseMock.mockReturnValue(null);

    await expect(resolveOpenRouterRuntimeCredential(USER)).rejects.toMatchObject({
      errorCode: "PERSISTENCE_UNAVAILABLE",
      statusCode: 503,
    });
  });
});
