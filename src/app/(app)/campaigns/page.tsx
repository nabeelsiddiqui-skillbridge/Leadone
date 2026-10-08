import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CampaignsTable, type CampaignListRow } from "@/components/campaigns/campaigns-table";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "id, name, status, start_date, updated_at, agent:agents(name), phone_number:phone_numbers(phone_number), contacts:campaign_contacts(count)"
    )
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: calls } =
    campaignIds.length > 0
      ? await supabase
          .from("calls")
          .select("campaign_id, status, appointment_id")
          .eq("workspace_id", workspace.id)
          .in("campaign_id", campaignIds)
      : { data: [] as { campaign_id: string | null; status: string; appointment_id: string | null }[] };

  const statsByCampaign = new Map<string, { callsMade: number; connected: number; appointments: number }>();
  for (const call of calls ?? []) {
    if (!call.campaign_id) continue;
    const s = statsByCampaign.get(call.campaign_id) ?? { callsMade: 0, connected: 0, appointments: 0 };
    s.callsMade += 1;
    if (call.status === "completed") s.connected += 1;
    if (call.appointment_id) s.appointments += 1;
    statsByCampaign.set(call.campaign_id, s);
  }

  const rows: CampaignListRow[] = (campaigns ?? []).map((c) => {
    const agent = c.agent as unknown as { name: string } | null;
    const phoneNumber = c.phone_number as unknown as { phone_number: string } | null;
    const contacts = c.contacts as unknown as { count: number }[] | null;
    const stats = statsByCampaign.get(c.id) ?? { callsMade: 0, connected: 0, appointments: 0 };
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      agentName: agent?.name ?? null,
      phoneNumber: phoneNumber?.phone_number ?? null,
      totalLeads: Array.isArray(contacts) ? (contacts[0]?.count ?? 0) : 0,
      callsMade: stats.callsMade,
      connected: stats.connected,
      appointments: stats.appointments,
      startDate: c.start_date,
      lastActivity: c.updated_at,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="Outbound calling lists — pick an agent, add leads, and set the schedule."
        action={
          <Button asChild>
            <Link href="/campaigns/new">New campaign</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a calling list for one of your outbound agents to start dialing leads."
          actionHref="/campaigns/new"
          actionLabel="New campaign"
        />
      ) : (
        <CampaignsTable campaigns={rows} />
      )}
    </div>
  );
}
