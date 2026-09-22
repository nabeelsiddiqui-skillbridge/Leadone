import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd";
});

describe("crypto", () => {
  it("round-trips a secret through encrypt/decrypt", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const plaintext = "sk-test-1234567890abcdef";
    const { ciphertext, iv } = encryptSecret(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(decryptSecret({ ciphertext, iv })).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const { encryptSecret } = await import("./crypto");
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails to decrypt with a tampered ciphertext (authenticity check)", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const { ciphertext, iv } = encryptSecret("sensitive-value");
    const tampered = ciphertext.slice(0, -4) + (ciphertext.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    expect(() => decryptSecret({ ciphertext: tampered, iv })).toThrow();
  });

  it("masks a secret, keeping only the last few characters visible", async () => {
    const { maskSecret } = await import("./crypto");
    const masked = maskSecret("sk-abcdefghijklmnop4821");
    expect(masked.endsWith("4821")).toBe(true);
    expect(masked).not.toContain("abcdefghijklmnop");
  });
});
