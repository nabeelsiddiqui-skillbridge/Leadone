import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { CreateTicketDialog } from "@/components/support/create-ticket-dialog";

export const metadata: Metadata = { title: "Support" };

const STATUS_VARIANT: Record<string, "success" | "secondary" | "warning"> = {
  open: "warning",
  in_progress: "warning",
  resolved: "success",
  closed: "secondary",
};

export default async function SupportPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, priority, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Support"
        description="Reach the LeadOne team for help — replies land right here."
        action={<CreateTicketDialog />}
      />

      {!tickets || tickets.length === 0 ? (
        <EmptyState title="No tickets yet" description="Open a ticket and we'll get back to you here." />
      ) : (
        <ul className="divide-y rounded-lg border">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/${ticket.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(ticket.updated_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[ticket.status] ?? "secondary"}>
                  {ticket.status.replace("_", " ")}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
