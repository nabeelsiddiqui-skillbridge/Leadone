import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/campaigns/wizard/campaign-wizard";

export const metadata: Metadata = { title: "New Campaign" };

const CONTACTS_LIMIT = 200;

export default async function NewCampaignPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const [{ data: agents }, { data: phoneNumbers }, { data: contacts, count: contactsCount }] =
    await Promise.all([
      supabase
        .from("agents")
        .select("id, name, agent_role, voice")
        .eq("workspace_id", workspace.id)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("phone_numbers")
        .select("id, phone_number, friendly_name, country")
        .eq("workspace_id", workspace.id)
        .eq("status", "active")
        .order("phone_number"),
      supabase
        .from("contacts")
        .select("id, first_name, last_name, company, phone, email", { count: "exact" })
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(CONTACTS_LIMIT),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-sm text-muted-foreground">
          Choose an agent, a calling number, a lead list, and a schedule.
        </p>
      </div>

      <CampaignWizard
        agents={agents ?? []}
        phoneNumbers={phoneNumbers ?? []}
        contacts={contacts ?? []}
        contactsCapped={(contactsCount ?? 0) > CONTACTS_LIMIT}
      />
    </div>
  );
}
