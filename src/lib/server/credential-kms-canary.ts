import { randomUUID } from "node:crypto";
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  type CredentialDataKeyProvider,
  type CredentialEncryptionContext,
} from "./credential-crypto";

const CANARY_SECRET = "new-era-kms-canary-v1";

export interface CredentialKmsCanaryResult {
  status: "pass";
  roundTrip: true;
  contextMismatchRejected: true;
}

export class CredentialKmsCanaryError extends Error {
  constructor(
    public readonly code:
      | "KMS_CANARY_OPERATION_FAILED"
      | "KMS_CANARY_CONTEXT_MISMATCH_ACCEPTED",
    message: string
  ) {
    super(message);
    this.name = "CredentialKmsCanaryError";
  }
}

function createCanaryContext(): CredentialEncryptionContext {
  return {
    credentialId: randomUUID(),
    provider: "openrouter",
    origin: "user_oauth",
  };
}

function isAwsKmsContextMismatch(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "InvalidCiphertextException"
  );
}

/**
 * Runs the Stage 3 credential-encryption readiness canary against an injected
 * data-key provider.
 *
 * With the live AWS provider this performs one GenerateDataKey call, one
 * successful Decrypt call for the envelope round-trip, and one intentionally
 * failing Decrypt call with a different credential_id. The negative check only
 * passes for AWS KMS InvalidCiphertextException; throttling, timeout, expired
 * credentials and other operational failures fail the canary.
 *
 * The result contains safe pass/fail metadata only. The canary does not persist
 * provider credentials, ciphertext, data keys or OIDC tokens.
 *
 * @param dataKeyProvider Configured provider used for data-key generation and decryption.
 * @returns Safe pass metadata after the round-trip and KMS context check succeed.
 * @throws {CredentialKmsCanaryError} KMS_CANARY_OPERATION_FAILED when a canary
 * operation cannot be proven, or KMS_CANARY_CONTEXT_MISMATCH_ACCEPTED when the
 * provider unexpectedly decrypts with a changed encryption context.
 */
export async function runCredentialKmsCanary(
  dataKeyProvider: CredentialDataKeyProvider
): Promise<CredentialKmsCanaryResult> {
  const context = createCanaryContext();

  let envelope;
  try {
    envelope = await encryptCredentialSecret(
      CANARY_SECRET,
      dataKeyProvider,
      context
    );

    const plaintext = await decryptCredentialSecret(
      envelope,
      dataKeyProvider,
      context
    );

    if (plaintext !== CANARY_SECRET) {
      throw new CredentialKmsCanaryError(
        "KMS_CANARY_OPERATION_FAILED",
        "Credential KMS canary round-trip validation failed."
      );
    }
  } catch (error) {
    if (error instanceof CredentialKmsCanaryError) {
      throw error;
    }
    throw new CredentialKmsCanaryError(
      "KMS_CANARY_OPERATION_FAILED",
      "Credential KMS canary round-trip failed."
    );
  }

  const mismatchedContext: CredentialEncryptionContext = {
    ...context,
    credentialId: randomUUID(),
  };

  let unexpectedPlaintextKey: Uint8Array | null = null;
  try {
    unexpectedPlaintextKey = await dataKeyProvider.decryptDataKey(
      envelope.encryptedDek,
      envelope.kmsKeyId,
      mismatchedContext
    );
  } catch (error) {
    if (isAwsKmsContextMismatch(error)) {
      return {
        status: "pass",
        roundTrip: true,
        contextMismatchRejected: true,
      };
    }

    throw new CredentialKmsCanaryError(
      "KMS_CANARY_OPERATION_FAILED",
      "Credential KMS canary context verification failed."
    );
  } finally {
    unexpectedPlaintextKey?.fill(0);
  }

  throw new CredentialKmsCanaryError(
    "KMS_CANARY_CONTEXT_MISMATCH_ACCEPTED",
    "Credential KMS canary accepted a mismatched encryption context."
  );
}
