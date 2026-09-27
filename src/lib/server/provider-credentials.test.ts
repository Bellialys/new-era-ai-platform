import { describe, expect, it } from "vitest";
import {
  hasEncryptedCredentialEnvelope,
  isAiFundingSource,
  isUsableProviderCredential,
  type ProviderCredentialRecord,
} from "./provider-credentials";

function credential(
  overrides: Partial<ProviderCredentialRecord> = {}
): ProviderCredentialRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    provider: "openrouter",
    origin: "user_oauth",
    status: "active",
    providerKeyHash: null,
    safeFingerprint: null,
    envelope: {
      secretCiphertext: new Uint8Array([1]),
      encryptedDek: new Uint8Array([2]),
      kmsKeyId: "kms-key-ref",
      encryptionVersion: 1,
    },
    limitUsd: null,
    limitReset: null,
    expiresAt: null,
    lastVerifiedAt: null,
    lastUsedAt: null,
    reconcileAfter: null,
    revokedAt: null,
    lastErrorCode: null,
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("provider credential domain", () => {
  it("accepts only known funding sources", () => {
    expect(isAiFundingSource("platform")).toBe(true);
    expect(isAiFundingSource("user_openrouter")).toBe(true);
    expect(isAiFundingSource("arbitrary")).toBe(false);
    expect(isAiFundingSource(null)).toBe(false);
  });

  it("requires a complete encrypted envelope", () => {
    expect(hasEncryptedCredentialEnvelope(credential())).toBe(true);
    expect(hasEncryptedCredentialEnvelope(credential({ envelope: null }))).toBe(false);
    expect(
      hasEncryptedCredentialEnvelope(
        credential({
          envelope: {
            secretCiphertext: new Uint8Array(),
            encryptedDek: new Uint8Array([2]),
            kmsKeyId: "kms-key-ref",
            encryptionVersion: 1,
          },
        })
      )
    ).toBe(false);
  });

  it("only treats active encrypted credentials as usable", () => {
    expect(isUsableProviderCredential(credential())).toBe(true);
    expect(isUsableProviderCredential(credential({ status: "pending" }))).toBe(false);
    expect(isUsableProviderCredential(credential({ status: "revoked" }))).toBe(false);
    expect(isUsableProviderCredential(credential({ envelope: null }))).toBe(false);
  });
});
