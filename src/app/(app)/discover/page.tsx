import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { NewProfileDialog } from "@/components/discover/new-profile-dialog";
import { ProfileSwitcher } from "@/components/discover/profile-switcher";
import { UploadCsvDialog } from "@/components/discover/upload-csv-dialog";
import { DiscoverLeadList } from "@/components/discover/discover-lead-list";
import type { LeadCardData } from "@/components/discover/types";
import { Target, Flame, Radar, CircleCheck, PhoneCall } from "lucide-react";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const { profile: profileIdParam } = await searchParams;

  const { data: profiles } = await supabase
    .from("discovery_profiles")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (!profiles || profiles.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Discover"
          description="An AI agent that finds businesses matching your ideal customer profile, scores them with evidence, and hands qualified leads straight to your calling campaigns."
        />
        <EmptyState
          title="Set up your first search"
          description="Describe who you're selling to - industries, locations, company size, signals to watch for - and start finding matching companies."
        />
        <NewProfileDialog agents={[]} standalone />
      </div>
    );
  }

  const activeProfile = profiles.find((p) => p.id === profileIdParam) ?? profiles[0];

  const [{ data: leads }, { data: agents }, { data: campaigns }] = await Promise.all([
    supabase
      .from("discovered_leads")
      .select("*, company:discovered_companies(*), contact:discovered_contacts(*), signals:discovered_signals(*)")
      .eq("workspace_id", workspace.id)
      .eq("discovery_profile_id", activeProfile.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("campaigns").select("id, name, agent_id").eq("workspace_id", workspace.id).order("name"),
  ]);

  const rawLeads = leads ?? [];

  const cardLeads: LeadCardData[] = rawLeads.map((l) => {
    const company = l.company as unknown as {
      name: string;
      website: string | null;
      industry: string | null;
      location: string | null;
      company_size: string | null;
      source_key: string;
    };
    const contact = l.contact as unknown as { name: string | null; title: string | null; email: string | null; phone: string | null } | null;
    const signals = (l.signals as unknown as { id: string; signal_type: LeadCardData["signals"][number]["signal_type"]; description: string; evidence_url: string | null }[]) ?? [];

    return {
      id: l.id,
      status: l.status,
      fitScore: l.fit_score,
      confidenceLevel: l.confidence_level,
      detectedSignalSummary: l.detected_signal_summary,
      reason: l.reason,
      suggestedOutreachAngle: l.suggested_outreach_angle,
      qualificationStatus: l.qualification_status,
      rejectReason: l.reject_reason,
      campaignId: l.campaign_id,
      createdAt: l.created_at,
      company: {
        name: company?.name ?? "Unknown company",
        website: company?.website ?? null,
        industry: company?.industry ?? null,
        location: company?.location ?? null,
        companySize: company?.company_size ?? null,
        sourceKey: company?.source_key ?? "",
      },
      contact: contact ? { name: contact.name, title: contact.title, email: contact.email, phone: contact.phone } : null,
      signals,
    };
  });

  const newLeads = cardLeads.filter((l) => l.status === "new");
  const highPriority = newLeads.filter((l) => (l.fitScore ?? 0) >= 70);
  const totalSignals = cardLeads.reduce((sum, l) => sum + l.signals.length, 0);
  const approved = cardLeads.filter((l) => l.status === "approved").length;
  const converted = cardLeads.filter((l) => l.status === "converted").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Discover"
        description="Companies your AI agent found that match this search, with the evidence behind every pick."
        action={
          <div className="flex items-center gap-2">
            <ProfileSwitcher profiles={profiles} activeProfileId={activeProfile.id} />
            <UploadCsvDialog discoveryProfileId={activeProfile.id} />
            <NewProfileDialog agents={agents ?? []} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="New leads" value={newLeads.length} icon={Radar} />
        <StatCard label="High priority" value={highPriority.length} icon={Flame} helper="Fit score 70+" />
        <StatCard label="Signals found" value={totalSignals} icon={Target} />
        <StatCard label="Approved" value={approved} icon={CircleCheck} />
        <StatCard label="Converted to calling" value={converted} icon={PhoneCall} />
      </div>

      <DiscoverLeadList leads={cardLeads} campaigns={campaigns ?? []} />
    </div>
  );
}
