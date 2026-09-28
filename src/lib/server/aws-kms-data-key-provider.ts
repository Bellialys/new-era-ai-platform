import { randomUUID } from "node:crypto";
import {
  DecryptCommand,
  type DecryptCommandOutput,
  GenerateDataKeyCommand,
  type GenerateDataKeyCommandOutput,
  KMSClient,
} from "@aws-sdk/client-kms";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import type {
  CredentialDataKeyProvider,
  CredentialEncryptionContext,
  DataKeyMaterial,
} from "./credential-crypto";

const AES_256_KEY_BYTES = 32;

type KmsCommand = GenerateDataKeyCommand | DecryptCommand;
type KmsCommandOutput = GenerateDataKeyCommandOutput | DecryptCommandOutput;

export interface KmsClientLike {
  send(command: KmsCommand): Promise<KmsCommandOutput>;
}

export interface AwsKmsEnvironment {
  AWS_REGION?: string;
  AWS_ROLE_ARN?: string;
  AI_CREDENTIAL_KMS_KEY_ID?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
}

export class AwsKmsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AwsKmsConfigurationError";
  }
}

function encryptionContext(
  context: CredentialEncryptionContext
): Record<string, string> {
  return {
    credential_id: context.credentialId,
    provider: context.provider,
    origin: context.origin,
  };
}

function requireNonEmpty(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new AwsKmsConfigurationError(`${name} is required for AWS KMS.`);
  }
  return normalized;
}

function assertNoStaticAwsCredentials(env: AwsKmsEnvironment): void {
  if (
    env.AWS_ACCESS_KEY_ID ||
    env.AWS_SECRET_ACCESS_KEY ||
    env.AWS_SESSION_TOKEN
  ) {
    throw new AwsKmsConfigurationError(
      "Static AWS credentials are not allowed for the provider-credential KMS path."
    );
  }
}

function kmsRuntimeFromEnv(env: AwsKmsEnvironment): {
  client: KmsClientLike;
  keyId: string;
} {
  assertNoStaticAwsCredentials(env);

  const region = requireNonEmpty(env.AWS_REGION, "AWS_REGION");
  const roleArn = requireNonEmpty(env.AWS_ROLE_ARN, "AWS_ROLE_ARN");
  const keyId = requireNonEmpty(
    env.AI_CREDENTIAL_KMS_KEY_ID,
    "AI_CREDENTIAL_KMS_KEY_ID"
  );

  const client = new KMSClient({
    region,
    credentials: awsCredentialsProvider({
      roleArn,
      clientConfig: {
        region,
      },
    }),
  });

  return {
    client: client as KmsClientLike,
    keyId,
  };
}

function isAwsAccessDenied(error: unknown): boolean {
  return error instanceof Error && error.name === "AccessDeniedException";
}

function copyRequiredBytes(
  value: Uint8Array | undefined,
  label: string,
  expectedLength?: number
): Uint8Array {
  if (!value || value.byteLength === 0) {
    throw new Error(`AWS KMS did not return ${label}.`);
  }
  if (expectedLength !== undefined && value.byteLength !== expectedLength) {
    throw new Error(`AWS KMS returned an invalid ${label} length.`);
  }
  return new Uint8Array(value);
}

function copyAndWipeSensitiveBytes(
  value: Uint8Array | undefined,
  label: string,
  expectedLength: number
): Uint8Array {
  if (!value || value.byteLength === 0) {
    throw new Error(`AWS KMS did not return ${label}.`);
  }

  try {
    if (value.byteLength !== expectedLength) {
      throw new Error(`AWS KMS returned an invalid ${label} length.`);
    }
    return new Uint8Array(value);
  } finally {
    value.fill(0);
  }
}

export class AwsKmsDataKeyProvider implements CredentialDataKeyProvider {
  constructor(
    private readonly client: KmsClientLike,
    private readonly keyId: string
  ) {
    if (!keyId.trim()) {
      throw new AwsKmsConfigurationError("AWS KMS key id is required.");
    }
  }

  async generateDataKey(
    context: CredentialEncryptionContext
  ): Promise<DataKeyMaterial> {
    const output = (await this.client.send(
      new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: "AES_256",
        EncryptionContext: encryptionContext(context),
      })
    )) as GenerateDataKeyCommandOutput;

    const plaintextKey = copyAndWipeSensitiveBytes(
      output.Plaintext,
      "plaintext data key",
      AES_256_KEY_BYTES
    );
    const encryptedKey = copyRequiredBytes(
      output.CiphertextBlob,
      "encrypted data key"
    );

    return {
      plaintextKey,
      encryptedKey,
      kmsKeyId: output.KeyId?.trim() || this.keyId,
    };
  }

  async decryptDataKey(
    encryptedKey: Uint8Array,
    kmsKeyId: string,
    context: CredentialEncryptionContext
  ): Promise<Uint8Array> {
    if (encryptedKey.byteLength === 0) {
      throw new Error("Encrypted data key is required.");
    }

    const normalizedKeyId = requireNonEmpty(kmsKeyId, "AWS KMS key id");

    const output = (await this.client.send(
      new DecryptCommand({
        CiphertextBlob: encryptedKey,
        KeyId: normalizedKeyId,
        EncryptionContext: encryptionContext(context),
      })
    )) as DecryptCommandOutput;

    return copyAndWipeSensitiveBytes(
      output.Plaintext,
      "decrypted data key",
      AES_256_KEY_BYTES
    );
  }
}

export function createAwsKmsDataKeyProviderFromEnv(
  env: AwsKmsEnvironment = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_ROLE_ARN: process.env.AWS_ROLE_ARN,
    AI_CREDENTIAL_KMS_KEY_ID: process.env.AI_CREDENTIAL_KMS_KEY_ID,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
  }
): AwsKmsDataKeyProvider {
  const { client, keyId } = kmsRuntimeFromEnv(env);
  return new AwsKmsDataKeyProvider(client, keyId);
}

export interface AwsKmsExtraContextCanaryResult {
  status: "pass";
  extraContextRejected: true;
}

/**
 * Proves that the configured IAM/KMS policy rejects an unexpected encryption
 * context key. The only accepted proof is AWS AccessDeniedException.
 *
 * The request intentionally uses GenerateDataKey with one extra context key.
 * If AWS unexpectedly accepts it, any returned plaintext data key is wiped and
 * the canary fails closed.
 */
export async function runAwsKmsExtraContextPolicyCanary(
  client: KmsClientLike,
  keyId: string
): Promise<AwsKmsExtraContextCanaryResult> {
  const normalizedKeyId = requireNonEmpty(keyId, "AWS KMS key id");
  let plaintext: Uint8Array | undefined;

  try {
    const output = (await client.send(
      new GenerateDataKeyCommand({
        KeyId: normalizedKeyId,
        KeySpec: "AES_256",
        EncryptionContext: {
          credential_id: randomUUID(),
          provider: "openrouter",
          origin: "user_oauth",
          policy_probe_extra: "must_be_denied",
        },
      })
    )) as GenerateDataKeyCommandOutput;

    plaintext = output.Plaintext;
  } catch (error) {
    if (isAwsAccessDenied(error)) {
      return {
        status: "pass",
        extraContextRejected: true,
      };
    }

    throw new Error("AWS KMS extra-context policy canary could not be proven.");
  } finally {
    plaintext?.fill(0);
  }

  throw new Error("AWS KMS accepted an unexpected encryption-context key.");
}

export async function runAwsKmsExtraContextPolicyCanaryFromEnv(
  env: AwsKmsEnvironment = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_ROLE_ARN: process.env.AWS_ROLE_ARN,
    AI_CREDENTIAL_KMS_KEY_ID: process.env.AI_CREDENTIAL_KMS_KEY_ID,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
  }
): Promise<AwsKmsExtraContextCanaryResult> {
  const { client, keyId } = kmsRuntimeFromEnv(env);
  return runAwsKmsExtraContextPolicyCanary(client, keyId);
}
