import { describe, expect, it } from "vitest";

import { dedupKeyFor, normalizeDomain } from "./dedupe";

describe("normalizeDomain", () => {
  it("strips protocol and www", () => {
    expect(normalizeDomain("https://www.acme.com")).toBe("acme.com");
    expect(normalizeDomain("http://acme.com")).toBe("acme.com");
  });

  it("accepts a bare domain with no protocol", () => {
    expect(normalizeDomain("acme.com")).toBe("acme.com");
  });

  it("lowercases the host", () => {
    expect(normalizeDomain("https://ACME.com")).toBe("acme.com");
  });

  it("preserves subdomains other than www", () => {
    expect(normalizeDomain("https://app.acme.com")).toBe("app.acme.com");
  });

  it("returns null for empty or unparseable input", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
  });
});

describe("dedupKeyFor", () => {
  it("uses the normalized domain when a website is known", () => {
    expect(dedupKeyFor("Acme Inc", "https://www.acme.com")).toBe("acme.com");
  });

  it("treats different spellings of the same domain as the same key", () => {
    const a = dedupKeyFor("Acme Inc.", "https://acme.com/");
    const b = dedupKeyFor("ACME INCORPORATED", "http://www.acme.com");
    expect(a).toBe(b);
  });

  it("falls back to a slugified name when there is no website", () => {
    expect(dedupKeyFor("Acme Inc.")).toBe("name:acme-inc");
  });

  it("slugifies punctuation and casing consistently for the name fallback", () => {
    const a = dedupKeyFor("Acme, Inc.");
    const b = dedupKeyFor("acme inc");
    expect(a).toBe(b);
  });

  it("does not collide a name-fallback key with a domain key for a different company", () => {
    const withDomain = dedupKeyFor("Acme Inc", "acme.com");
    const withoutDomain = dedupKeyFor("Acme Inc");
    expect(withDomain).not.toBe(withoutDomain);
  });
});
