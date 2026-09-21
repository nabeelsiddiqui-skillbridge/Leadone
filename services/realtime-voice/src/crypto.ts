import { createDecipheriv, createCipheriv, randomBytes, scryptSync } from "node:crypto";

// Mirrors src/lib/crypto.ts in the Next.js app. Duplicated deliberately:
// this service is meant to be deployable independently of the Next app (see
// README), so it doesn't import Next-app source across the package
// boundary. Keep the two in sync if the algorithm ever changes.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY is not set.");
  if (/^[0-9a-f]{64}$/i.test(secret)) return Buffer.from(secret, "hex");
  if (secret.length === 44 && /[=/+]/.test(secret)) {
    try {
      const buf = Buffer.from(secret, "base64");
      if (buf.length === 32) return buf;
    } catch {
      // fall through
    }
  }
  return scryptSync(secret, "leadone-static-salt", 32);
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const key = getKey();
  const ivBuf = Buffer.from(iv, "base64");
  const data = Buffer.from(ciphertext, "base64");
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function encryptSecret(plaintext: string): { ciphertext: string; iv: string } {
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
