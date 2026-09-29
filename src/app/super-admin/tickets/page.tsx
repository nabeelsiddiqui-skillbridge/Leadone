import type { Metadata } from "next";
import Link from "next/link";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Super Admin | Tickets" };

const STATUS_VARIANT: Record<string, "success" | "secondary" | "warning"> = {
  open: "warning",
  in_progress: "warning",
  resolved: "success",
  closed: "secondary",
};

export default async function SuperAdminTicketsPage() {
  await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { data: tickets } = await db
    .from("support_tickets")
    .select("id, subject, status, priority, updated_at, workspace:workspaces(name)")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Support Tickets" description="Every ticket across every workspace." />

      {!tickets || tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets yet.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {tickets.map((ticket) => {
            const workspace = ticket.workspace as unknown as { name: string } | null;
            return (
              <li key={ticket.id}>
                <Link
                  href={`/super-admin/tickets/${ticket.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {workspace?.name ?? "Unknown workspace"} · Updated{" "}
                      {new Date(ticket.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[ticket.status] ?? "secondary"}>
                    {ticket.status.replace("_", " ")}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
