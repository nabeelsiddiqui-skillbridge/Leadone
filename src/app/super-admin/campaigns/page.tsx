import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminCampaignRowActions } from "@/components/super-admin/admin-campaign-row-actions";

export const metadata: Metadata = { title: "Super Admin | Campaigns" };

function statusVariant(status: string): "success" | "warning" | "secondary" {
  if (status === "running") return "success";
  if (status === "paused") return "warning";
  return "secondary";
}

export default async function SuperAdminCampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, updated_at, workspace:workspaces(id,name), agent:agents(id,name)")
    .order("created_at", { ascending: false })
    .limit(500);

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const [{ data: leadRows }, { data: callRows }] = await Promise.all([
    campaignIds.length
      ? supabase.from("campaign_contacts").select("campaign_id").in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as { campaign_id: string }[] }),
    campaignIds.length
      ? supabase.from("calls").select("campaign_id").in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as { campaign_id: string | null }[] }),
  ]);

  const leadCounts = new Map<string, number>();
  for (const row of leadRows ?? []) leadCounts.set(row.campaign_id, (leadCounts.get(row.campaign_id) ?? 0) + 1);
  const callCounts = new Map<string, number>();
  for (const row of callRows ?? []) {
    if (!row.campaign_id) continue;
    callCounts.set(row.campaign_id, (callCounts.get(row.campaign_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Campaigns" description="Every campaign across every workspace on the platform." />

      {!campaigns || campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Campaigns created by any workspace will show up here." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const workspace = campaign.workspace as unknown as { id: string; name: string } | null;
                const agent = campaign.agent as unknown as { id: string; name: string } | null;
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{workspace?.name ?? "—"}</TableCell>
                    <TableCell>{agent?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                    </TableCell>
                    <TableCell>{leadCounts.get(campaign.id) ?? 0}</TableCell>
                    <TableCell>
                      <Link href={`/super-admin/calls?campaignId=${campaign.id}`} className="hover:underline">
                        {callCounts.get(campaign.id) ?? 0}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <AdminCampaignRowActions id={campaign.id} status={campaign.status} />
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
