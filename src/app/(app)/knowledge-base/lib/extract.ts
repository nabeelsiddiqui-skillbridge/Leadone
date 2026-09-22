import "server-only";

import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

const URL_FETCH_TIMEOUT_MS = 20_000;

/** Extracts plain text from an uploaded file's raw bytes, dispatching on file extension. */
export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string | null
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    ext === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // .txt, .csv, and anything else unrecognized: treat as plain UTF-8 text.
  return buffer.toString("utf-8");
}

/**
 * Fetches a URL server-side and strips it down to readable text with
 * cheerio: drops <script>/<style>/etc., takes the visible body text, and
 * collapses whitespace.
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadOneKnowledgeBaseBot/1.0; +https://leadone.example/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error.";
    throw new Error(`Failed to fetch ${url}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml|text\/plain|xml/i.test(contentType)) {
    throw new Error(`Unsupported content type for URL ingestion: ${contentType || "unknown"}.`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, template, nav, footer").remove();

  const bodyText = $("body").length > 0 ? $("body").text() : $.root().text();

  return bodyText
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
