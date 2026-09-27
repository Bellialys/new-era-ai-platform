import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type {
  EncryptedCredentialEnvelope,
  ProviderCredentialOrigin,
} from "./provider-credentials";

const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const ENCRYPTION_VERSION = 1;
const MAX_SECRET_BYTES = 16 * 1024;

export interface CredentialEncryptionContext {
  credentialId: string;
  provider: "openrouter";
  origin: ProviderCredentialOrigin;
}

export interface DataKeyMaterial {
  plaintextKey: Uint8Array;
  encryptedKey: Uint8Array;
  kmsKeyId: string;
}

export interface CredentialDataKeyProvider {
  generateDataKey(context: CredentialEncryptionContext): Promise<DataKeyMaterial>;
  decryptDataKey(
    encryptedKey: Uint8Array,
    kmsKeyId: string,
    context: CredentialEncryptionContext
  ): Promise<Uint8Array>;
}

export class CredentialCryptoError extends Error {
  constructor(
    public readonly code:
      | "CREDENTIAL_CRYPTO_INVALID_INPUT"
      | "CREDENTIAL_CRYPTO_KEY_PROVIDER"
      | "CREDENTIAL_CRYPTO_ENCRYPT_FAILED"
      | "CREDENTIAL_CRYPTO_DECRYPT_FAILED",
    message: string
  ) {
    super(message);
    this.name = "CredentialCryptoError";
  }
}

function contextAad(context: CredentialEncryptionContext): Buffer {
  if (
    !context.credentialId.trim() ||
    context.provider !== "openrouter" ||
    !context.origin
  ) {
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_INVALID_INPUT",
      "Invalid credential encryption context."
    );
  }

  return Buffer.from(
    `credential_id=${context.credentialId}\nprovider=${context.provider}\norigin=${context.origin}`,
    "utf8"
  );
}

function assertDataKey(key: Uint8Array): void {
  if (key.byteLength !== AES_KEY_BYTES) {
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_KEY_PROVIDER",
      "Credential data key must be 256 bits."
    );
  }
}

function toMutableBuffer(value: Uint8Array): Buffer {
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

export async function encryptCredentialSecret(
  secret: string,
  dataKeyProvider: CredentialDataKeyProvider,
  context: CredentialEncryptionContext
): Promise<EncryptedCredentialEnvelope> {
  const secretBytes = Buffer.from(secret, "utf8");
  if (secretBytes.byteLength === 0 || secretBytes.byteLength > MAX_SECRET_BYTES) {
    secretBytes.fill(0);
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_INVALID_INPUT",
      "Credential secret length is invalid."
    );
  }

  let keyMaterial: DataKeyMaterial;
  try {
    keyMaterial = await dataKeyProvider.generateDataKey(context);
  } catch {
    secretBytes.fill(0);
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_KEY_PROVIDER",
      "Credential data-key generation failed."
    );
  }

  const plaintextKey = toMutableBuffer(keyMaterial.plaintextKey);
  try {
    assertDataKey(plaintextKey);

    if (
      keyMaterial.encryptedKey.byteLength === 0 ||
      keyMaterial.kmsKeyId.trim().length === 0
    ) {
      throw new CredentialCryptoError(
        "CREDENTIAL_CRYPTO_KEY_PROVIDER",
        "Credential data-key metadata is incomplete."
      );
    }

    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", plaintextKey, iv);
    cipher.setAAD(contextAad(context));

    const ciphertext = Buffer.concat([
      cipher.update(secretBytes),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const packedCiphertext = Buffer.concat([iv, authTag, ciphertext]);
    return {
      secretCiphertext: new Uint8Array(packedCiphertext),
      encryptedDek: new Uint8Array(keyMaterial.encryptedKey),
      kmsKeyId: keyMaterial.kmsKeyId,
      encryptionVersion: ENCRYPTION_VERSION,
    };
  } catch (error) {
    if (error instanceof CredentialCryptoError) {
      throw error;
    }
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_ENCRYPT_FAILED",
      "Credential encryption failed."
    );
  } finally {
    plaintextKey.fill(0);
    secretBytes.fill(0);
  }
}

export async function decryptCredentialSecret(
  envelope: EncryptedCredentialEnvelope,
  dataKeyProvider: CredentialDataKeyProvider,
  context: CredentialEncryptionContext
): Promise<string> {
  if (
    envelope.encryptionVersion !== ENCRYPTION_VERSION ||
    envelope.secretCiphertext.byteLength <= GCM_IV_BYTES + GCM_TAG_BYTES ||
    envelope.encryptedDek.byteLength === 0 ||
    envelope.kmsKeyId.trim().length === 0
  ) {
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_INVALID_INPUT",
      "Encrypted credential envelope is invalid."
    );
  }

  let plaintextKeyBytes: Uint8Array;
  try {
    plaintextKeyBytes = await dataKeyProvider.decryptDataKey(
      envelope.encryptedDek,
      envelope.kmsKeyId,
      context
    );
  } catch {
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_KEY_PROVIDER",
      "Credential data-key decryption failed."
    );
  }

  const plaintextKey = toMutableBuffer(plaintextKeyBytes);
  let plaintext: Buffer | null = null;

  try {
    assertDataKey(plaintextKey);

    const packed = Buffer.from(
      envelope.secretCiphertext.buffer,
      envelope.secretCiphertext.byteOffset,
      envelope.secretCiphertext.byteLength
    );
    const iv = packed.subarray(0, GCM_IV_BYTES);
    const authTag = packed.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_TAG_BYTES);
    const ciphertext = packed.subarray(GCM_IV_BYTES + GCM_TAG_BYTES);

    const decipher = createDecipheriv("aes-256-gcm", plaintextKey, iv);
    decipher.setAAD(contextAad(context));
    decipher.setAuthTag(authTag);

    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  } catch (error) {
    if (error instanceof CredentialCryptoError) {
      throw error;
    }
    throw new CredentialCryptoError(
      "CREDENTIAL_CRYPTO_DECRYPT_FAILED",
      "Credential decryption failed."
    );
  } finally {
    plaintextKey.fill(0);
    plaintext?.fill(0);
  }
}
