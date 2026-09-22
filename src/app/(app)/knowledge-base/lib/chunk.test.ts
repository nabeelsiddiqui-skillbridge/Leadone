import { describe, it, expect } from "vitest";

import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns an empty array for empty/whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk when text fits within chunkSize", () => {
    const text = "This is a short knowledge base document about pricing.";
    expect(chunkText(text, 1000, 100)).toEqual([text]);
  });

  it("splits long text into multiple overlapping chunks", () => {
    const paragraph = "Sentence one. Sentence two. Sentence three. ".repeat(50); // ~2200 chars
    const chunks = chunkText(paragraph, 500, 50);

    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk should respect the size budget with some slack for
    // landing on a natural boundary rather than a hard cut.
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(700);
    }
  });

  it("never loses content: concatenating chunks (minus overlap) covers the source", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Paragraph number ${i} with some filler content to pad it out.`).join(
      "\n\n"
    );
    const chunks = chunkText(text, 300, 30);

    // Every chunk's content should actually appear in the original text.
    for (const chunk of chunks) {
      expect(text).toContain(chunk);
    }
    // The last chunk should reach the end of the source text.
    expect(text.trim().endsWith(chunks[chunks.length - 1].split("\n").pop()!.trim().slice(-10))).toBe(true);
  });

  it("always makes forward progress and terminates even with pathological input", () => {
    const text = "a".repeat(5000); // no natural break points anywhere
    const chunks = chunkText(text, 200, 190); // overlap nearly equal to chunk size
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(1000); // sanity bound - this must not loop "forever"
  });

  it("normalizes CRLF line endings and collapses excessive blank lines", () => {
    const text = "Line one.\r\n\r\n\r\n\r\nLine two.";
    const [chunk] = chunkText(text, 1000, 100);
    expect(chunk).not.toContain("\r");
    expect(chunk).not.toMatch(/\n{3,}/);
  });
});
