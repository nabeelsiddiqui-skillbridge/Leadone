import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";

type DocumentStatus = Database["public"]["Tables"]["knowledge_documents"]["Row"]["status"];

const STATUS_LABEL: Record<DocumentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  error: "Error",
};

const STATUS_VARIANT: Record<DocumentStatus, "secondary" | "warning" | "success" | "destructive"> = {
  pending: "secondary",
  processing: "warning",
  ready: "success",
  error: "destructive",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
