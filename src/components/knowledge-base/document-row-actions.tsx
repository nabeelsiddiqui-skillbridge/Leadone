"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteDocumentAction, reprocessDocumentAction } from "@/app/(app)/knowledge-base/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/lib/supabase/database.types";

type DocumentStatus = Database["public"]["Tables"]["knowledge_documents"]["Row"]["status"];

export function DocumentRowActions({
  documentId,
  documentName,
  status,
}: {
  documentId: string;
  documentName: string;
  status: DocumentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleReprocess() {
    startTransition(async () => {
      const result = await reprocessDocumentAction(documentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Document reprocessed.");
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${documentName}"? This removes its indexed chunks too.`)) return;
    startTransition(async () => {
      const result = await deleteDocumentAction(documentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Document deleted.");
        router.refresh();
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(status === "error" || status === "ready") && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleReprocess(); }}>
            <RefreshCw /> Reprocess
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); handleDelete(); }}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
