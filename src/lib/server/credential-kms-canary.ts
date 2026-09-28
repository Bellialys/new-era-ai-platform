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
      | "KMS_CANARY_ROUND_TRIP_FAILED"
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
        "KMS_CANARY_ROUND_TRIP_FAILED",
        "Credential KMS canary round-trip validation failed."
      );
    }
  } catch (error) {
    if (error instanceof CredentialKmsCanaryError) {
      throw error;
    }
    throw new CredentialKmsCanaryError(
      "KMS_CANARY_ROUND_TRIP_FAILED",
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
  } catch {
    return {
      status: "pass",
      roundTrip: true,
      contextMismatchRejected: true,
    };
  } finally {
    unexpectedPlaintextKey?.fill(0);
  }

  throw new CredentialKmsCanaryError(
    "KMS_CANARY_CONTEXT_MISMATCH_ACCEPTED",
    "Credential KMS canary accepted a mismatched encryption context."
  );
}
