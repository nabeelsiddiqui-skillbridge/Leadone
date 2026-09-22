/**
 * Plain-text chunking for the ingestion pipeline. No tokenizer dependency:
 * chunks are sized in characters (~1000) with a ~100-character overlap
 * between consecutive chunks, and token_count is approximated downstream as
 * Math.ceil(chunk.length / 4) rather than pulling in tiktoken.
 *
 * The splitter tries to land each chunk boundary on a paragraph break, then
 * a sentence end, then a line break, then a plain space, searching backward
 * from the ideal cut point — so chunks read as coherent passages instead of
 * being sliced mid-word or mid-sentence whenever text is available to do so.
 */

export const DEFAULT_CHUNK_SIZE = 1000;
export const DEFAULT_CHUNK_OVERLAP = 100;

const BOUNDARY_SEARCH_WINDOW = 200;

/** Finds the best place at or before `idealEnd` to end a chunk. */
function findBreakPoint(text: string, idealEnd: number): number {
  if (idealEnd >= text.length) return text.length;

  const windowStart = Math.max(0, idealEnd - BOUNDARY_SEARCH_WINDOW);
  const slice = text.slice(windowStart, idealEnd);

  const paragraphBreak = slice.lastIndexOf("\n\n");
  if (paragraphBreak !== -1) return windowStart + paragraphBreak + 2;

  let lastSentenceEnd = -1;
  const sentenceEndPattern = /[.!?]\s/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceEndPattern.exec(slice)) !== null) {
    lastSentenceEnd = match.index + match[0].length;
  }
  if (lastSentenceEnd !== -1) return windowStart + lastSentenceEnd;

  const lineBreak = slice.lastIndexOf("\n");
  if (lineBreak !== -1) return windowStart + lineBreak + 1;

  const spaceBreak = slice.lastIndexOf(" ");
  if (spaceBreak !== -1) return windowStart + spaceBreak + 1;

  return idealEnd;
}

/**
 * Splits `rawText` into overlapping chunks of roughly `chunkSize` characters.
 * Returns an empty array for text that is empty after normalization.
 */
export function chunkText(
  rawText: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return [];
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const idealEnd = Math.min(start + chunkSize, text.length);
    const end = idealEnd >= text.length ? text.length : findBreakPoint(text, idealEnd);
    const safeEnd = end > start ? end : idealEnd;

    const chunk = text.slice(start, safeEnd).trim();
    if (chunk) chunks.push(chunk);

    if (safeEnd >= text.length) break;

    const nextStart = safeEnd - overlap;
    start = nextStart > start ? nextStart : safeEnd; // always make forward progress
  }

  return chunks;
}
