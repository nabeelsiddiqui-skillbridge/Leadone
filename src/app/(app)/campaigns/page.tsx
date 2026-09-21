import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignsTable, type CampaignListRow } from "@/components/campaigns/campaigns-table";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, agent:agents(name), phone_number:phone_numbers(phone_number)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const campaignIds = (campaigns ?? []).map((c) => c.id);

  const [{ data: contactRows }, { data: callRows }, { data: appointmentRows }] =
    campaignIds.length > 0
      ? await Promise.all([
          supabase
            .from("campaign_contacts")
            .select("campaign_id")
            .eq("workspace_id", workspace.id)
            .in("campaign_id", campaignIds),
          supabase
            .from("calls")
            .select("campaign_id, status")
            .eq("workspace_id", workspace.id)
            .in("campaign_id", campaignIds),
          supabase
            .from("appointments")
            .select("campaign_id")
            .eq("workspace_id", workspace.id)
            .in("campaign_id", campaignIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const leadCounts = new Map<string, number>();
  for (const row of contactRows ?? []) {
    leadCounts.set(row.campaign_id, (leadCounts.get(row.campaign_id) ?? 0) + 1);
  }

  const callCounts = new Map<string, number>();
  const connectedCounts = new Map<string, number>();
  for (const row of callRows ?? []) {
    if (!row.campaign_id) continue;
    callCounts.set(row.campaign_id, (callCounts.get(row.campaign_id) ?? 0) + 1);
    if (row.status === "completed") {
      connectedCounts.set(row.campaign_id, (connectedCounts.get(row.campaign_id) ?? 0) + 1);
    }
  }

  const appointmentCounts = new Map<string, number>();
  for (const row of appointmentRows ?? []) {
    if (!row.campaign_id) continue;
    appointmentCounts.set(row.campaign_id, (appointmentCounts.get(row.campaign_id) ?? 0) + 1);
  }

  const rows: CampaignListRow[] = (campaigns ?? []).map((campaign) => {
    const agent = campaign.agent as unknown as { name: string } | null;
    const phoneNumber = campaign.phone_number as unknown as { phone_number: string } | null;
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      agentName: agent?.name ?? null,
      phoneNumber: phoneNumber?.phone_number ?? null,
      totalLeads: leadCounts.get(campaign.id) ?? 0,
      callsMade: callCounts.get(campaign.id) ?? 0,
      connected: connectedCounts.get(campaign.id) ?? 0,
      appointments: appointmentCounts.get(campaign.id) ?? 0,
      startDate: campaign.start_date,
      lastActivity: campaign.updated_at,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Decide which leads get called, by which agent, and on what schedule.
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">New campaign</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a campaign to attach an agent, a calling number, a lead list, and a schedule."
          actionHref="/campaigns/new"
          actionLabel="New campaign"
        />
      ) : (
        <CampaignsTable campaigns={rows} />
      )}
    </div>
  );
}
