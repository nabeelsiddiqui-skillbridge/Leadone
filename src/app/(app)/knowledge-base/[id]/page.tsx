import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { AddContentDialog } from "@/components/knowledge-base/add-content-dialog";
import { DocumentStatusBadge } from "@/components/knowledge-base/document-status-badge";
import { DocumentRowActions } from "@/components/knowledge-base/document-row-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const SOURCE_TYPE_LABEL: Record<string, string> = {
  text: "Text",
  file: "File",
  url: "URL",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Knowledge Base ${id}` };
}

export default async function KnowledgeBaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: knowledgeBase, error: kbError } = await supabase
    .from("knowledge_bases")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (kbError) {
    throw new Error(`Failed to load knowledge base: ${kbError.message}`);
  }
  if (!knowledgeBase) {
    notFound();
  }

  const { data: documents, error: documentsError } = await supabase
    .from("knowledge_documents")
    .select("*, chunks:knowledge_chunks(count)")
    .eq("knowledge_base_id", id)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (documentsError) {
    throw new Error(`Failed to load documents: ${documentsError.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/knowledge-base" className="text-sm text-muted-foreground hover:underline">
          ← Back to knowledge bases
        </Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{knowledgeBase.name}</h1>
            {knowledgeBase.description && (
              <p className="text-sm text-muted-foreground">{knowledgeBase.description}</p>
            )}
          </div>
          <AddContentDialog knowledgeBaseId={knowledgeBase.id} />
        </div>
      </div>

      {!documents || documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Add plain text, upload a file (.txt, .csv, .pdf, .docx), or pull in a URL. Each document is chunked and embedded automatically."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const chunkCount = Array.isArray(doc.chunks)
                  ? ((doc.chunks[0] as unknown as { count: number } | undefined)?.count ?? 0)
                  : 0;
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="max-w-xs">
                      <p className="truncate font-medium">{doc.name}</p>
                      {doc.status === "error" && doc.error_message && (
                        <p className="truncate text-xs text-destructive">{doc.error_message}</p>
                      )}
                      {doc.source_type === "url" && doc.source_url && (
                        <p className="truncate text-xs text-muted-foreground">{doc.source_url}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{SOURCE_TYPE_LABEL[doc.source_type] ?? doc.source_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">{chunkCount}</TableCell>
                    <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DocumentRowActions documentId={doc.id} documentName={doc.name} status={doc.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
