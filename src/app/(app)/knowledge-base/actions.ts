"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveCredential } from "@/lib/credentials";
import type { Database } from "@/lib/supabase/database.types";
import { KNOWLEDGE_BASE_STORAGE_BUCKET, MAX_UPLOAD_BYTES, SUPPORTED_FILE_EXTENSIONS } from "./lib/constants";
import { chunkText } from "./lib/chunk";
import { extractTextFromBuffer, extractTextFromUrl } from "./lib/extract";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type KnowledgeDocumentRow = Database["public"]["Tables"]["knowledge_documents"]["Row"];

export interface ActionState {
  error?: string;
  message?: string;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 96;
const CHUNK_INSERT_BATCH_SIZE = 200;

function cleanString(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? `.${parts.pop()}` : "";
}

// ---------------------------------------------------------------------------
// Knowledge bases
// ---------------------------------------------------------------------------

export async function createKnowledgeBaseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const name = cleanString(formData.get("name"));
  const description = cleanString(formData.get("description"));

  if (!name) {
    return { error: "Name is required." };
  }

  const { data, error } = await supabase
    .from("knowledge_bases")
    .insert({ workspace_id: workspace.id, name, description })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/knowledge-base");
  return { message: data.id };
}

export async function deleteKnowledgeBaseAction(id: string): Promise<{ error?: string }> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_bases")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/knowledge-base");
  return {};
}

// ---------------------------------------------------------------------------
// Document creation (text / file / url) — each inserts a knowledge_documents
// row and then runs it straight through the ingestion pipeline below.
// ---------------------------------------------------------------------------

export async function createTextDocumentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const knowledgeBaseId = String(formData.get("knowledge_base_id") ?? "");
  const name = cleanString(formData.get("name"));
  const content = String(formData.get("content") ?? "").trim();

  if (!knowledgeBaseId) return { error: "Missing knowledge base." };
  if (!name) return { error: "Name is required." };
  if (!content) return { error: "Content cannot be empty." };

  const { data: document, error: insertError } = await supabase
    .from("knowledge_documents")
    .insert({
      knowledge_base_id: knowledgeBaseId,
      workspace_id: workspace.id,
      name,
      source_type: "text",
      mime_type: "text/plain",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !document) {
    return { error: insertError?.message ?? "Failed to create document." };
  }

  const storagePath = `${workspace.id}/${document.id}.txt`;
  const { error: uploadError } = await supabase.storage
    .from(KNOWLEDGE_BASE_STORAGE_BUCKET)
    .upload(storagePath, content, { contentType: "text/plain", upsert: true });

  if (uploadError) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "error", error_message: `Failed to store content: ${uploadError.message}` })
      .eq("id", document.id)
      .eq("workspace_id", workspace.id);
    revalidatePath(`/knowledge-base/${knowledgeBaseId}`);
    return { error: `Failed to store content: ${uploadError.message}` };
  }

  await supabase
    .from("knowledge_documents")
    .update({ storage_path: storagePath })
    .eq("id", document.id)
    .eq("workspace_id", workspace.id);

  const result = await processDocumentAction(document.id);
  revalidatePath(`/knowledge-base/${knowledgeBaseId}`);
  return result.error ? { error: result.error } : { message: "Document added." };
}

export async function createUrlDocumentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const knowledgeBaseId = String(formData.get("knowledge_base_id") ?? "");
  const url = cleanString(formData.get("url"));
  const nameInput = cleanString(formData.get("name"));

  if (!knowledgeBaseId) return { error: "Missing knowledge base." };
  if (!url) return { error: "URL is required." };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Enter a valid URL, including https://." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Only http(s) URLs are supported." };
  }

  const { data: document, error: insertError } = await supabase
    .from("knowledge_documents")
    .insert({
      knowledge_base_id: knowledgeBaseId,
      workspace_id: workspace.id,
      name: nameInput ?? parsed.hostname + parsed.pathname,
      source_type: "url",
      source_url: parsed.toString(),
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !document) {
    return { error: insertError?.message ?? "Failed to create document." };
  }

  const result = await processDocumentAction(document.id);
  revalidatePath(`/knowledge-base/${knowledgeBaseId}`);
  return result.error ? { error: result.error } : { message: "Document added." };
}

export async function uploadFileDocumentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const knowledgeBaseId = String(formData.get("knowledge_base_id") ?? "");
  const file = formData.get("file");
  const nameInput = cleanString(formData.get("name"));

  if (!knowledgeBaseId) return { error: "Missing knowledge base." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB).` };
  }
  const ext = extensionOf(file.name);
  if (!SUPPORTED_FILE_EXTENSIONS.includes(ext as (typeof SUPPORTED_FILE_EXTENSIONS)[number])) {
    return { error: `Unsupported file type "${ext || "unknown"}". Supported: ${SUPPORTED_FILE_EXTENSIONS.join(", ")}.` };
  }

  const { data: document, error: insertError } = await supabase
    .from("knowledge_documents")
    .insert({
      knowledge_base_id: knowledgeBaseId,
      workspace_id: workspace.id,
      name: nameInput ?? file.name,
      source_type: "file",
      mime_type: file.type || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !document) {
    return { error: insertError?.message ?? "Failed to create document." };
  }

  const storagePath = `${workspace.id}/${document.id}${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(KNOWLEDGE_BASE_STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "error", error_message: `Failed to store file: ${uploadError.message}` })
      .eq("id", document.id)
      .eq("workspace_id", workspace.id);
    revalidatePath(`/knowledge-base/${knowledgeBaseId}`);
    return { error: `Failed to store file: ${uploadError.message}` };
  }

  await supabase
    .from("knowledge_documents")
    .update({ storage_path: storagePath })
    .eq("id", document.id)
    .eq("workspace_id", workspace.id);

  const result = await processDocumentAction(document.id);
  revalidatePath(`/knowledge-base/${knowledgeBaseId}`);
  return result.error ? { error: result.error } : { message: "Document added." };
}

export async function deleteDocumentAction(documentId: string): Promise<{ error?: string }> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: document } = await supabase
    .from("knowledge_documents")
    .select("id, knowledge_base_id, storage_path")
    .eq("id", documentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!document) {
    return { error: "Document not found." };
  }

  // knowledge_chunks has ON DELETE CASCADE on document_id, so deleting the
  // document row is enough to remove its chunks too.
  const { error } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId)
    .eq("workspace_id", workspace.id);

  if (error) {
    return { error: error.message };
  }

  if (document.storage_path) {
    // Best effort: the document row is already gone either way.
    await supabase.storage.from(KNOWLEDGE_BASE_STORAGE_BUCKET).remove([document.storage_path]);
  }

  revalidatePath(`/knowledge-base/${document.knowledge_base_id}`);
  return {};
}

// ---------------------------------------------------------------------------
// Ingestion pipeline
// ---------------------------------------------------------------------------

/**
 * Extracts plain text for a document from whichever source it came from.
 * 'text' and 'file' documents are both backed by an object in Supabase
 * Storage (plain text typed into the dialog is uploaded as a .txt blob so
 * ingestion has one uniform, re-runnable code path); 'url' documents are
 * re-fetched and scraped live.
 */
async function extractDocumentText(
  supabase: SupabaseServerClient,
  document: KnowledgeDocumentRow
): Promise<string> {
  if (document.source_type === "url") {
    if (!document.source_url) throw new Error("This document has no source URL.");
    return extractTextFromUrl(document.source_url);
  }

  if (!document.storage_path) {
    throw new Error("This document has no stored file to process.");
  }

  const { data: blob, error } = await supabase.storage
    .from(KNOWLEDGE_BASE_STORAGE_BUCKET)
    .download(document.storage_path);

  if (error || !blob) {
    throw new Error(error?.message ?? "Failed to download the stored file.");
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  return extractTextFromBuffer(buffer, document.name, document.mime_type);
}

async function embedChunks(openai: OpenAI, chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    embeddings.push(...sorted.map((d) => d.embedding));
  }

  return embeddings;
}

/**
 * Runs the full ingestion pipeline for one knowledge_documents row: extract
 * text -> chunk it -> embed each chunk with OpenAI -> bulk-insert
 * knowledge_chunks -> mark the document 'ready' (or 'error' with a message
 * if anything throws — it is never left stuck on 'pending'/'processing').
 *
 * Known constraint: this runs synchronously inside a Server Action, which on
 * most serverless hosts has an execution time limit (e.g. Vercel's default
 * is well under a minute on hobby/pro tiers). A very large PDF or a very
 * long web page could in theory exceed that. There's no queue/background
 * worker for ingestion in this phase — see the module report for why that's
 * an intentional scope cut here rather than an oversight.
 */
export async function processDocumentAction(documentId: string): Promise<{ error?: string }> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: document, error: fetchError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (fetchError || !document) {
    return { error: "Document not found." };
  }

  await supabase
    .from("knowledge_documents")
    .update({ status: "processing", error_message: null })
    .eq("id", documentId)
    .eq("workspace_id", workspace.id);

  try {
    const text = await extractDocumentText(supabase, document);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      const message = "No extractable text was found in this document.";
      await supabase
        .from("knowledge_documents")
        .update({ status: "error", error_message: message })
        .eq("id", documentId)
        .eq("workspace_id", workspace.id);
      revalidatePath(`/knowledge-base/${document.knowledge_base_id}`);
      return { error: message };
    }

    const apiKey = await resolveCredential(workspace.id, "openai", "api_key");
    if (!apiKey) {
      throw new Error(
        "No OpenAI API key is configured. Add one for this workspace, or set OPENAI_API_KEY on the platform."
      );
    }
    const openai = new OpenAI({ apiKey });
    const embeddings = await embedChunks(openai, chunks);

    // Clear any chunks from a previous attempt (e.g. a manual reprocess)
    // before inserting the fresh set.
    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("workspace_id", workspace.id);

    const rows: Database["public"]["Tables"]["knowledge_chunks"]["Insert"][] = chunks.map((content, i) => ({
      document_id: documentId,
      knowledge_base_id: document.knowledge_base_id,
      workspace_id: workspace.id,
      chunk_index: i,
      content,
      token_count: Math.ceil(content.length / 4),
      embedding: embeddings[i],
    }));

    for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + CHUNK_INSERT_BATCH_SIZE);
      const { error: chunkInsertError } = await supabase.from("knowledge_chunks").insert(batch);
      if (chunkInsertError) throw new Error(chunkInsertError.message);
    }

    await supabase
      .from("knowledge_documents")
      .update({ status: "ready", error_message: null })
      .eq("id", documentId)
      .eq("workspace_id", workspace.id);

    revalidatePath(`/knowledge-base/${document.knowledge_base_id}`);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process document.";
    await supabase
      .from("knowledge_documents")
      .update({ status: "error", error_message: message })
      .eq("id", documentId)
      .eq("workspace_id", workspace.id);
    revalidatePath(`/knowledge-base/${document.knowledge_base_id}`);
    return { error: message };
  }
}

/** Re-runs the ingestion pipeline for a document stuck in 'error' (or to refresh a 'ready' one). */
export async function reprocessDocumentAction(documentId: string): Promise<{ error?: string }> {
  return processDocumentAction(documentId);
}
