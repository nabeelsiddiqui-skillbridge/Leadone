import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NewKnowledgeBaseDialog } from "@/components/knowledge-base/new-knowledge-base-dialog";
import { KnowledgeBaseRowActions } from "@/components/knowledge-base/knowledge-base-row-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Knowledge Base" };

export default async function KnowledgeBasePage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: knowledgeBases, error } = await supabase
    .from("knowledge_bases")
    .select("*, documents:knowledge_documents(count), chunks:knowledge_chunks(count)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load knowledge bases: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Knowledge Base"
        description="Documents your agents can search while talking to callers — pricing, FAQs, policies, anything they need to answer questions accurately."
        action={<NewKnowledgeBaseDialog />}
      />

      {!knowledgeBases || knowledgeBases.length === 0 ? (
        <EmptyState
          title="No knowledge bases yet"
          description="Create a knowledge base, then add text, files, or URLs for your agents to search from."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {knowledgeBases.map((kb) => {
                const documentCount = Array.isArray(kb.documents)
                  ? ((kb.documents[0] as unknown as { count: number } | undefined)?.count ?? 0)
                  : 0;
                const chunkCount = Array.isArray(kb.chunks)
                  ? ((kb.chunks[0] as unknown as { count: number } | undefined)?.count ?? 0)
                  : 0;
                return (
                  <TableRow key={kb.id}>
                    <TableCell className="font-medium">
                      <Link href={`/knowledge-base/${kb.id}`} className="hover:underline">
                        {kb.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {kb.description || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{documentCount}</TableCell>
                    <TableCell className="tabular-nums">{chunkCount}</TableCell>
                    <TableCell>{new Date(kb.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <KnowledgeBaseRowActions id={kb.id} name={kb.name} />
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
