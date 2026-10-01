"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runDiscoveryJob } from "@/lib/discovery/runDiscoveryJob";
import { checkDiscoveryLimits } from "@/lib/discovery/limits";
import type { CustomerCsvRow } from "@/lib/discovery/sources/customerCsv";
import type { DiscoveryChannel } from "@/lib/supabase/database.types";

export interface ActionState {
  error?: string;
  message?: string;
}

function cleanString(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Discovery profiles (target-customer setup)
// ---------------------------------------------------------------------------

export async function saveDiscoveryProfileAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const user = await getCurrentUser();

  const profileId = cleanString(formData.get("profile_id"));
  const name = cleanString(formData.get("name"));
  const productDescription = cleanString(formData.get("product_description"));
  if (!name) return { error: "Give this search a name." };
  if (!productDescription) return { error: "Describe what you're selling." };

  const sizeMinRaw = cleanString(formData.get("company_size_min"));
  const sizeMaxRaw = cleanString(formData.get("company_size_max"));

  const fields = {
    name,
    product_description: productDescription,
    icp_description: cleanString(formData.get("icp_description")),
    target_industries: splitList(formData.get("target_industries")),
    target_locations: splitList(formData.get("target_locations")),
    company_size_min: sizeMinRaw ? Number.parseInt(sizeMinRaw, 10) : null,
    company_size_max: sizeMaxRaw ? Number.parseInt(sizeMaxRaw, 10) : null,
    keywords: splitList(formData.get("keywords")),
    exclusions: splitList(formData.get("exclusions")),
    preferred_channel: (cleanString(formData.get("preferred_channel")) ?? "call") as DiscoveryChannel,
    signals_to_monitor: formData.getAll("signals_to_monitor").map(String),
  };

  if (profileId) {
    const { error } = await supabase
      .from("discovery_profiles")
      .update(fields)
      .eq("id", profileId)
      .eq("workspace_id", workspace.id);
    if (error) return { error: error.message };
    revalidatePath("/discover");
    return { message: profileId };
  }

  const { data, error } = await supabase
    .from("discovery_profiles")
    .insert({ workspace_id: workspace.id, created_by: user?.id ?? null, ...fields })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create profile." };

  revalidatePath("/discover");
  return { message: data.id };
}

// ---------------------------------------------------------------------------
// Discovery jobs
// ---------------------------------------------------------------------------

/** The one real, live source: a company list the workspace already has permission to contact. */
export async function runCustomerCsvDiscoveryAction(
  discoveryProfileId: string,
  rows: CustomerCsvRow[]
): Promise<{ error?: string; companiesFound?: number; leadsCreated?: number }> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  if (rows.length === 0) return { error: "No rows to import." };

  const { data: profile } = await supabase
    .from("discovery_profiles")
    .select("id")
    .eq("id", discoveryProfileId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!profile) return { error: "Discovery profile not found." };

  const limitCheck = await checkDiscoveryLimits(supabase, workspace.id);
  if (limitCheck.error) return { error: limitCheck.error };

  const { data: job, error: jobError } = await supabase
    .from("discovery_jobs")
    .insert({
      workspace_id: workspace.id,
      discovery_profile_id: discoveryProfileId,
      source_key: "customer_csv",
      trigger: "manual",
    })
    .select("id")
    .single();
  if (jobError || !job) return { error: jobError?.message ?? "Failed to start job." };

  const result = await runDiscoveryJob(supabase, job.id, { rows });

  revalidatePath("/discover");
  if (result.error) return { error: result.error };
  return { companiesFound: result.companiesFound, leadsCreated: result.leadsCreated };
}

// ---------------------------------------------------------------------------
// Lead review
// ---------------------------------------------------------------------------

export async function approveLeadAction(leadId: string): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("discovered_leads")
    .update({ status: "approved", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("workspace_id", workspace.id)
    .eq("status", "new");

  if (error) return { error: error.message };
  revalidatePath("/discover");
  return {};
}

export async function rejectLeadAction(leadId: string, reason?: string): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("discovered_leads")
    .update({
      status: "rejected",
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      reject_reason: reason?.trim() || null,
    })
    .eq("id", leadId)
    .eq("workspace_id", workspace.id)
    .in("status", ["new", "approved"]);

  if (error) return { error: error.message };
  revalidatePath("/discover");
  return {};
}

/**
 * Converts an approved lead into a real contact and adds it to the chosen
 * agent's calling list (LeadOne has no email-sending campaigns today, so
 * this is the one real handoff path). Campaigns aren't a user-facing
 * concept anymore - each agent effectively has one calling list, found or
 * created here rather than picked explicitly. Refuses if the underlying
 * contact is already an active member of a different agent's calling list,
 * so the same lead can't unintentionally end up being worked twice.
 */
export async function convertLeadToCampaignAction(
  leadId: string,
  agentId: string,
  phoneOverride?: string
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("discovered_leads")
    .select("*, company:discovered_companies(*), contact:discovered_contacts(*)")
    .eq("id", leadId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!lead) return { error: "Lead not found." };
  if (lead.status !== "approved") return { error: "Approve this lead before adding it to a campaign." };

  const company = lead.company as unknown as { name: string; website: string | null; industry: string | null } | null;
  const primaryContact = lead.contact as unknown as { name: string | null; title: string | null; email: string | null; phone: string | null } | null;

  const phone = (phoneOverride?.trim() || primaryContact?.phone?.trim()) ?? "";
  if (!phone) {
    return { error: "No phone number is known for this lead. Enter one to add it to a calling campaign." };
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name")
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!agent) return { error: "Agent not found." };

  let campaign: { id: string; agent_id: string } | null = null;
  const { data: existingCampaign } = await supabase
    .from("campaigns")
    .select("id, agent_id")
    .eq("workspace_id", workspace.id)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingCampaign) {
    campaign = existingCampaign;
  } else {
    const { data: newCampaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        workspace_id: workspace.id,
        agent_id: agentId,
        name: `${agent.name} - calling list`,
        status: "draft",
        timezone_mode: "contact_local",
        days_of_week: [1, 2, 3, 4, 5],
        calling_start_time: "09:00",
        calling_end_time: "18:00",
        daily_call_limit: 50,
        concurrency_limit: 2,
        max_attempts: 3,
        voicemail_action: "leave_message",
      })
      .select("id, agent_id")
      .single();
    if (campaignError || !newCampaign) return { error: campaignError?.message ?? "Failed to set up this agent's calling list." };
    campaign = newCampaign;
  }

  const campaignId = campaign.id;

  const [firstName, ...restName] = (primaryContact?.name ?? "").split(" ").filter(Boolean);

  let contactId: string;
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("phone", phone)
    .maybeSingle();

  if (existingContact) {
    contactId = existingContact.id;
  } else {
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        workspace_id: workspace.id,
        phone,
        first_name: firstName || null,
        last_name: restName.join(" ") || null,
        company: company?.name ?? null,
        industry: company?.industry ?? null,
        website: company?.website ?? null,
        job_title: primaryContact?.title ?? null,
        email: primaryContact?.email ?? null,
        status: "new",
      })
      .select("id")
      .single();
    if (contactError || !newContact) return { error: contactError?.message ?? "Failed to create contact." };
    contactId = newContact.id;
  }

  // A contact already being actively worked by a different campaign is not
  // added to a second one silently - the same lead shouldn't get called by
  // two campaigns at once.
  const { data: activeMemberships } = await supabase
    .from("campaign_contacts")
    .select("campaign_id, campaign:campaigns(name)")
    .eq("workspace_id", workspace.id)
    .eq("contact_id", contactId)
    .in("status", ["pending", "queued", "in_progress"])
    .neq("campaign_id", campaignId);

  if (activeMemberships && activeMemberships.length > 0) {
    const other = activeMemberships[0].campaign as unknown as { name: string } | null;
    return {
      error: `This contact is already being called by another agent${other?.name ? ` ("${other.name}")` : ""}. Remove them there first, or wait for that to finish.`,
    };
  }

  const { error: linkError } = await supabase
    .from("campaign_contacts")
    .upsert({ campaign_id: campaignId, contact_id: contactId, workspace_id: workspace.id }, { onConflict: "campaign_id,contact_id" });
  if (linkError) return { error: linkError.message };

  if (lead.suggested_outreach_angle) {
    await supabase.from("contact_notes").insert({
      contact_id: contactId,
      workspace_id: workspace.id,
      note: `[Lead Discovery] Suggested angle: ${lead.suggested_outreach_angle}${lead.reason ? `\n\nWhy this lead: ${lead.reason}` : ""}`,
    });
  }

  const { error: updateError } = await supabase
    .from("discovered_leads")
    .update({
      status: "converted",
      converted_contact_id: contactId,
      campaign_id: campaignId,
      agent_id: campaign.agent_id,
      converted_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("workspace_id", workspace.id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/discover");
  revalidatePath(`/agents/${agentId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  return { message: "Added to the agent's calling list." };
}
