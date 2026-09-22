/**
 * Supabase Storage bucket that raw knowledge base source files (PDF, DOCX,
 * TXT, CSV, and the plain-text notes typed into the "Text" dialog) are
 * uploaded to. This bucket is referenced here but is NOT created by any
 * migration in this repo — Supabase Storage buckets are normally created via
 * the dashboard or the CLI, and there is no live Supabase project wired up
 * yet. Once a real project exists, create it once with either:
 *
 *   supabase storage buckets create knowledge-base-files
 *
 * or the equivalent dashboard action, before any upload/ingestion in this
 * module will succeed against real infrastructure.
 */
export const KNOWLEDGE_BASE_STORAGE_BUCKET = "knowledge-base-files";

/** File extensions accepted by the file-upload dialog and validated server-side. */
export const SUPPORTED_FILE_EXTENSIONS = [".txt", ".csv", ".pdf", ".docx"] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
