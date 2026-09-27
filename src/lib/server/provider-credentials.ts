export const PROVIDER_CREDENTIAL_ORIGINS = [
  "user_oauth",
  "user_manual",
  "platform_managed",
] as const;

export type ProviderCredentialOrigin =
  (typeof PROVIDER_CREDENTIAL_ORIGINS)[number];

export const PROVIDER_CREDENTIAL_STATUSES = [
  "pending",
  "active",
  "revoking",
  "revoked",
  "orphaned",
  "error",
] as const;

export type ProviderCredentialStatus =
  (typeof PROVIDER_CREDENTIAL_STATUSES)[number];

export const AI_FUNDING_SOURCES = ["platform", "user_openrouter"] as const;
export type AiFundingSource = (typeof AI_FUNDING_SOURCES)[number];

export interface EncryptedCredentialEnvelope {
  secretCiphertext: Uint8Array;
  encryptedDek: Uint8Array;
  kmsKeyId: string;
  encryptionVersion: number;
}

export interface ProviderCredentialRecord {
  id: string;
  userId: string;
  provider: "openrouter";
  origin: ProviderCredentialOrigin;
  status: ProviderCredentialStatus;
  providerKeyHash: string | null;
  safeFingerprint: string | null;
  envelope: EncryptedCredentialEnvelope | null;
  limitUsd: number | null;
  limitReset: "daily" | "weekly" | "monthly" | null;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
  lastUsedAt: string | null;
  reconcileAfter: string | null;
  revokedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiFundingPreference {
  userId: string;
  fundingSource: AiFundingSource;
  createdAt: string;
  updatedAt: string;
}

export function isAiFundingSource(value: unknown): value is AiFundingSource {
  return (
    typeof value === "string" &&
    (AI_FUNDING_SOURCES as readonly string[]).includes(value)
  );
}

export function hasEncryptedCredentialEnvelope(
  record: Pick<ProviderCredentialRecord, "envelope">
): boolean {
  const envelope = record.envelope;
  return Boolean(
    envelope &&
      envelope.secretCiphertext.byteLength > 0 &&
      envelope.encryptedDek.byteLength > 0 &&
      envelope.kmsKeyId.trim().length > 0 &&
      Number.isInteger(envelope.encryptionVersion) &&
      envelope.encryptionVersion > 0
  );
}

export function isUsableProviderCredential(
  record: Pick<ProviderCredentialRecord, "status" | "envelope">
): boolean {
  return record.status === "active" && hasEncryptedCredentialEnvelope(record);
}
