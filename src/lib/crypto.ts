import "server-only";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not set. Required to store/read encrypted credentials.");
  }
  // Accept either a 32-byte hex/base64 key or an arbitrary passphrase.
  if (/^[0-9a-f]{64}$/i.test(secret)) return Buffer.from(secret, "hex");
  if (secret.length === 44 && /[=/+]/.test(secret)) {
    try {
      const buf = Buffer.from(secret, "base64");
      if (buf.length === 32) return buf;
    } catch {
      // fall through to derivation
    }
  }
  return scryptSync(secret, "leadone-static-salt", 32);
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

/** Encrypts a secret (API key, OAuth token, etc.) for storage in the database. */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const data = Buffer.from(payload.ciphertext, "base64");
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Masks a secret for display, e.g. "sk-••••••••••4821". */
export function maskSecret(plaintext: string, visibleTail = 4): string {
  if (plaintext.length <= visibleTail) return "•".repeat(plaintext.length);
  const prefix = plaintext.slice(0, Math.min(3, plaintext.length - visibleTail));
  const tail = plaintext.slice(-visibleTail);
  return `${prefix}${"•".repeat(10)}${tail}`;
}
