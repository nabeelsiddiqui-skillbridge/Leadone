import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminCallsFilters } from "@/components/super-admin/admin-calls-filters";
import type { CallStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Super Admin | Calls" };

function statusVariant(status: string): "success" | "destructive" | "warning" | "secondary" {
  if (status === "completed") return "success";
  if (["failed", "canceled"].includes(status)) return "destructive";
  if (["ringing", "initiated", "queued", "in_progress"].includes(status)) return "warning";
  return "secondary";
}

export default async function SuperAdminCallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  let query = supabase
    .from("calls")
    .select(
      "id, status, outcome, duration_seconds, created_at, workspace:workspaces(id,name), contact:contacts(first_name,last_name,phone), agent:agents(id,name), campaign:campaigns(id,name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.campaignId) query = query.eq("campaign_id", params.campaignId);
  if (params.status) query = query.eq("status", params.status as CallStatus);
  if (params.failedOnly === "true") query = query.in("status", ["failed", "canceled"]);

  const { data: calls } = await query;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Calls" description="Every call placed by every workspace on the platform." />
      <AdminCallsFilters />

      {!calls || calls.length === 0 ? (
        <EmptyState title="No calls yet" description="Calls placed by any workspace will show up here." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => {
                const workspace = call.workspace as unknown as { id: string; name: string } | null;
                const contact = call.contact as unknown as { first_name: string | null; last_name: string | null; phone: string } | null;
                const campaign = call.campaign as unknown as { id: string; name: string } | null;
                const agent = call.agent as unknown as { id: string; name: string } | null;
                return (
                  <TableRow key={call.id}>
                    <TableCell>
                      <Link href={`/super-admin/calls/${call.id}`} className="hover:underline">
                        {new Date(call.created_at).toLocaleString()}
                      </Link>
                    </TableCell>
                    <TableCell>{workspace?.name ?? "—"}</TableCell>
                    <TableCell>
                      {[contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || contact?.phone || "—"}
                    </TableCell>
                    <TableCell>{campaign?.name ?? "—"}</TableCell>
                    <TableCell>{agent?.name ?? "—"}</TableCell>
                    <TableCell>{call.duration_seconds ? `${Math.round(call.duration_seconds / 60)}m` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(call.status)}>{call.status}</Badge>
                    </TableCell>
                    <TableCell>{call.outcome ?? "—"}</TableCell>
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
