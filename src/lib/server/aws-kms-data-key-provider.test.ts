import {
  DecryptCommand,
  GenerateDataKeyCommand,
} from "@aws-sdk/client-kms";
import { describe, expect, it } from "vitest";
import type { CredentialEncryptionContext } from "./credential-crypto";
import {
  AwsKmsConfigurationError,
  AwsKmsDataKeyProvider,
  createAwsKmsDataKeyProviderFromEnv,
  runAwsKmsExtraContextPolicyCanary,
  type KmsClientLike,
} from "./aws-kms-data-key-provider";

const context: CredentialEncryptionContext = {
  credentialId: "00000000-0000-4000-8000-000000000001",
  provider: "openrouter",
  origin: "user_oauth",
};

describe("AWS KMS data-key provider", () => {
  it("requests an AES-256 data key with non-PII encryption context", async () => {
    const commands: unknown[] = [];
    const sdkPlaintext = new Uint8Array(32).fill(1);
    const client: KmsClientLike = {
      async send(command) {
        commands.push(command);
        return {
          Plaintext: sdkPlaintext,
          CiphertextBlob: new Uint8Array([9, 8, 7]),
          KeyId: "kms-key-ref",
          $metadata: {},
        };
      },
    };

    const provider = new AwsKmsDataKeyProvider(client, "kms-key-ref");
    const result = await provider.generateDataKey(context);

    expect(result.plaintextKey).toHaveLength(32);
    expect([...result.plaintextKey]).toEqual(new Array(32).fill(1));
    expect([...sdkPlaintext]).toEqual(new Array(32).fill(0));
    expect(result.encryptedKey).toEqual(new Uint8Array([9, 8, 7]));
    expect(result.kmsKeyId).toBe("kms-key-ref");

    const command = commands[0];
    expect(command).toBeInstanceOf(GenerateDataKeyCommand);
    expect((command as GenerateDataKeyCommand).input).toMatchObject({
      KeySpec: "AES_256",
      EncryptionContext: {
        credential_id: context.credentialId,
        provider: "openrouter",
        origin: "user_oauth",
      },
    });
  });

  it("decrypts only with the stored KMS key id and matching context", async () => {
    const commands: unknown[] = [];
    const sdkPlaintext = new Uint8Array(32).fill(3);
    const client: KmsClientLike = {
      async send(command) {
        commands.push(command);
        return {
          Plaintext: sdkPlaintext,
          KeyId: "kms-key-ref",
          $metadata: {},
        };
      },
    };

    const provider = new AwsKmsDataKeyProvider(client, "configured-key");
    const plaintext = await provider.decryptDataKey(
      new Uint8Array([1, 2, 3]),
      "stored-key-id",
      context
    );

    expect(plaintext).toHaveLength(32);
    expect([...plaintext]).toEqual(new Array(32).fill(3));
    expect([...sdkPlaintext]).toEqual(new Array(32).fill(0));
    const command = commands[0];
    expect(command).toBeInstanceOf(DecryptCommand);
    expect((command as DecryptCommand).input).toMatchObject({
      KeyId: "stored-key-id",
      CiphertextBlob: new Uint8Array([1, 2, 3]),
      EncryptionContext: {
        credential_id: context.credentialId,
        provider: "openrouter",
        origin: "user_oauth",
      },
    });
  });

  it("fails closed on incomplete KMS responses", async () => {
    const client: KmsClientLike = {
      async send() {
        return { $metadata: {} };
      },
    };
    const provider = new AwsKmsDataKeyProvider(client, "kms-key-ref");

    await expect(provider.generateDataKey(context)).rejects.toThrow(
      "plaintext data key"
    );
  });

  it("passes only when AWS denies an unexpected encryption-context key", async () => {
    const commands: unknown[] = [];
    const client: KmsClientLike = {
      async send(command) {
        commands.push(command);
        const error = new Error("denied by policy");
        error.name = "AccessDeniedException";
        throw error;
      },
    };

    await expect(
      runAwsKmsExtraContextPolicyCanary(client, "kms-key-ref")
    ).resolves.toEqual({
      status: "pass",
      extraContextRejected: true,
    });

    expect(commands[0]).toBeInstanceOf(GenerateDataKeyCommand);
    expect((commands[0] as GenerateDataKeyCommand).input).toMatchObject({
      KeyId: "kms-key-ref",
      KeySpec: "AES_256",
      EncryptionContext: {
        provider: "openrouter",
        origin: "user_oauth",
        policy_probe_extra: "must_be_denied",
      },
    });
  });

  it("fails closed when the extra-context check is operationally inconclusive", async () => {
    const client: KmsClientLike = {
      async send() {
        const error = new Error("kms timeout");
        error.name = "DependencyTimeoutException";
        throw error;
      },
    };

    await expect(
      runAwsKmsExtraContextPolicyCanary(client, "kms-key-ref")
    ).rejects.toThrow("could not be proven");
  });

  it("wipes unexpected plaintext if AWS accepts the extra context", async () => {
    const sdkPlaintext = new Uint8Array(32).fill(7);
    const client: KmsClientLike = {
      async send() {
        return {
          Plaintext: sdkPlaintext,
          CiphertextBlob: new Uint8Array([1, 2, 3]),
          KeyId: "kms-key-ref",
          $metadata: {},
        };
      },
    };

    await expect(
      runAwsKmsExtraContextPolicyCanary(client, "kms-key-ref")
    ).rejects.toThrow("accepted an unexpected encryption-context key");

    expect([...sdkPlaintext]).toEqual(new Array(32).fill(0));
  });

  it("requires the documented KMS id and rejects static AWS credentials", () => {
    expect(() =>
      createAwsKmsDataKeyProviderFromEnv({
        AWS_REGION: "region-ref",
        AWS_ROLE_ARN: "role-ref",
        AI_CREDENTIAL_KMS_KEY_ID: "kms-key-ref",
        AWS_ACCESS_KEY_ID: "present",
      })
    ).toThrow(AwsKmsConfigurationError);

    expect(() =>
      createAwsKmsDataKeyProviderFromEnv({
        AWS_REGION: "region-ref",
      })
    ).toThrow("AWS_ROLE_ARN");

    expect(() =>
      createAwsKmsDataKeyProviderFromEnv({
        AWS_REGION: "region-ref",
        AWS_ROLE_ARN: "role-ref",
      })
    ).toThrow("AI_CREDENTIAL_KMS_KEY_ID");
  });
});
