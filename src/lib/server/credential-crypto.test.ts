import { describe, expect, it } from "vitest";
import {
  CredentialCryptoError,
  decryptCredentialSecret,
  encryptCredentialSecret,
  type CredentialDataKeyProvider,
  type CredentialEncryptionContext,
} from "./credential-crypto";

const context: CredentialEncryptionContext = {
  credentialId: "00000000-0000-4000-8000-000000000001",
  provider: "openrouter",
  origin: "user_oauth",
};

function fakeProvider() {
  const generatedKeys: Uint8Array[] = [];
  const decryptedKeys: Uint8Array[] = [];
  const fixedKey = new Uint8Array(32).fill(7);

  const provider: CredentialDataKeyProvider = {
    async generateDataKey() {
      const plaintextKey = new Uint8Array(fixedKey);
      generatedKeys.push(plaintextKey);
      return {
        plaintextKey,
        encryptedKey: new Uint8Array([9, 8, 7]),
        kmsKeyId: "kms-key-ref",
      };
    },
    async decryptDataKey() {
      const plaintextKey = new Uint8Array(fixedKey);
      decryptedKeys.push(plaintextKey);
      return plaintextKey;
    },
  };

  return { provider, generatedKeys, decryptedKeys };
}

describe("credential envelope crypto", () => {
  it("round-trips a provider secret with AES-256-GCM", async () => {
    const { provider } = fakeProvider();
    const envelope = await encryptCredentialSecret(
      "example-provider-secret",
      provider,
      context
    );

    expect(envelope.encryptionVersion).toBe(1);
    expect(envelope.kmsKeyId).toBe("kms-key-ref");
    expect(envelope.encryptedDek).toEqual(new Uint8Array([9, 8, 7]));
    expect(envelope.secretCiphertext.byteLength).toBeGreaterThan(28);

    await expect(
      decryptCredentialSecret(envelope, provider, context)
    ).resolves.toBe("example-provider-secret");
  });

  it("zeroes plaintext data-key buffers after use", async () => {
    const { provider, generatedKeys, decryptedKeys } = fakeProvider();
    const envelope = await encryptCredentialSecret("secret", provider, context);

    expect([...generatedKeys[0]!]).toEqual(new Array(32).fill(0));

    await decryptCredentialSecret(envelope, provider, context);
    expect([...decryptedKeys[0]!]).toEqual(new Array(32).fill(0));
  });

  it("binds ciphertext to the credential context", async () => {
    const { provider } = fakeProvider();
    const envelope = await encryptCredentialSecret("secret", provider, context);

    await expect(
      decryptCredentialSecret(envelope, provider, {
        ...context,
        credentialId: "00000000-0000-4000-8000-000000000099",
      })
    ).rejects.toMatchObject({
      code: "CREDENTIAL_CRYPTO_DECRYPT_FAILED",
    });
  });

  it("fails closed when ciphertext is corrupted", async () => {
    const { provider } = fakeProvider();
    const envelope = await encryptCredentialSecret("secret", provider, context);
    const corrupted = new Uint8Array(envelope.secretCiphertext);
    corrupted[corrupted.length - 1] ^= 1;

    await expect(
      decryptCredentialSecret(
        { ...envelope, secretCiphertext: corrupted },
        provider,
        context
      )
    ).rejects.toMatchObject({
      code: "CREDENTIAL_CRYPTO_DECRYPT_FAILED",
    });
  });

  it("rejects invalid data-key sizes without exposing the secret", async () => {
    const provider: CredentialDataKeyProvider = {
      async generateDataKey() {
        return {
          plaintextKey: new Uint8Array(16),
          encryptedKey: new Uint8Array([1]),
          kmsKeyId: "kms-key-ref",
        };
      },
      async decryptDataKey() {
        return new Uint8Array(16);
      },
    };

    const secret = "must-not-appear-in-errors";

    try {
      await encryptCredentialSecret(secret, provider, context);
      throw new Error("Expected encryption to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(CredentialCryptoError);
      expect(String((error as Error).message)).not.toContain(secret);
    }
  });
});
