import { describe, expect, it } from "vitest";
import type {
  CredentialDataKeyProvider,
  CredentialEncryptionContext,
} from "./credential-crypto";
import {
  CredentialKmsCanaryError,
  runCredentialKmsCanary,
} from "./credential-kms-canary";

function contextBoundProvider(): CredentialDataKeyProvider {
  const key = new Uint8Array(32).fill(11);
  let generatedContext: CredentialEncryptionContext | null = null;

  return {
    async generateDataKey(context) {
      generatedContext = { ...context };
      return {
        plaintextKey: new Uint8Array(key),
        encryptedKey: new Uint8Array([1, 2, 3]),
        kmsKeyId: "kms-key-ref",
      };
    },
    async decryptDataKey(_encryptedKey, _kmsKeyId, context) {
      if (
        !generatedContext ||
        generatedContext.credentialId !== context.credentialId ||
        generatedContext.provider !== context.provider ||
        generatedContext.origin !== context.origin
      ) {
        throw new Error("encryption context mismatch");
      }
      return new Uint8Array(key);
    },
  };
}

describe("credential KMS canary", () => {
  it("passes a round-trip and rejects a changed credential context", async () => {
    await expect(
      runCredentialKmsCanary(contextBoundProvider())
    ).resolves.toEqual({
      status: "pass",
      roundTrip: true,
      contextMismatchRejected: true,
    });
  });

  it("fails closed when the provider cannot generate a data key", async () => {
    const provider: CredentialDataKeyProvider = {
      async generateDataKey() {
        throw new Error("provider unavailable");
      },
      async decryptDataKey() {
        throw new Error("not reached");
      },
    };

    await expect(runCredentialKmsCanary(provider)).rejects.toMatchObject({
      name: "CredentialKmsCanaryError",
      code: "KMS_CANARY_ROUND_TRIP_FAILED",
    });
  });

  it("fails when a provider incorrectly accepts a mismatched context", async () => {
    const key = new Uint8Array(32).fill(5);
    const provider: CredentialDataKeyProvider = {
      async generateDataKey() {
        return {
          plaintextKey: new Uint8Array(key),
          encryptedKey: new Uint8Array([9, 9, 9]),
          kmsKeyId: "kms-key-ref",
        };
      },
      async decryptDataKey() {
        return new Uint8Array(key);
      },
    };

    await expect(runCredentialKmsCanary(provider)).rejects.toBeInstanceOf(
      CredentialKmsCanaryError
    );
  });
});
