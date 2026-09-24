"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/lib/supabase/database.types";

export interface ActionResult {
  error?: string;
}

/** New contact captured inline via CSV upload or manual entry in the wizard, not yet in `contacts`. */
export interface NewLeadPayload {
  first_name?: string;
  last_name?: string;
  company?: string;
  phone: string;
  email?: string;
  job_title?: string;
}

export interface CreateCampaignPayload {
  name: string;
  description: string;
  agentId: string;
  phoneNumberId: string | null;
  existingContactIds: string[];
  newLeads: NewLeadPayload[];
  timezoneMode: "contact_local" | "fixed" | "always";
  fixedTimezone: string | null;
  daysOfWeek: number[];
  callingStartTime: string;
  callingEndTime: string;
  startDate: string | null;
  endDate: string | null;
  dailyCallLimit: number;
  concurrencyLimit: number;
  maxAttempts: number;
  retryNoAnswerMinutes: number;
  retryBusyMinutes: number;
  retryFailedMinutes: number;
  retryExcludedStatuses: string[];
  voicemailAction: "hang_up" | "leave_message";
  status: "draft" | "scheduled";
}

/**
 * Creates a campaign, materializes any brand-new leads (from CSV/manual entry)
 * into `contacts`, attaches every selected/created contact via
 * `campaign_contacts`, then redirects to the new campaign's detail page.
 */
export async function createCampaignAction(payload: CreateCampaignPayload) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  if (!payload.name.trim()) {
    return { error: "Campaign name is required." };
  }
  if (!payload.agentId) {
    return { error: "An agent is required." };
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspace.id,
      agent_id: payload.agentId,
      phone_number_id: payload.phoneNumberId,
      name: payload.name.trim(),
      description: payload.description.trim() || null,
      status: payload.status,
      timezone_mode: payload.timezoneMode,
      fixed_timezone: payload.timezoneMode === "fixed" ? payload.fixedTimezone : null,
      days_of_week: payload.daysOfWeek,
      calling_start_time: payload.callingStartTime,
      calling_end_time: payload.callingEndTime,
      start_date: payload.startDate,
      end_date: payload.endDate,
      daily_call_limit: payload.dailyCallLimit,
      concurrency_limit: payload.concurrencyLimit,
      max_attempts: payload.maxAttempts,
      retry_no_answer_minutes: payload.retryNoAnswerMinutes,
      retry_busy_minutes: payload.retryBusyMinutes,
      retry_failed_minutes: payload.retryFailedMinutes,
      retry_excluded_statuses: payload.retryExcludedStatuses,
      voicemail_action: payload.voicemailAction,
      started_at: payload.status === "scheduled" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    return { error: campaignError?.message ?? "Failed to create campaign." };
  }

  const contactIds = new Set<string>(payload.existingContactIds);

  if (payload.newLeads.length > 0) {
    const { data: createdContacts, error: contactsError } = await supabase
      .from("contacts")
      .insert(
        payload.newLeads.map((lead) => ({
          workspace_id: workspace.id,
          first_name: lead.first_name || null,
          last_name: lead.last_name || null,
          company: lead.company || null,
          phone: lead.phone,
          email: lead.email || null,
          job_title: lead.job_title || null,
        }))
      )
      .select("id");

    if (contactsError) {
      return { error: `Campaign created, but leads failed to import: ${contactsError.message}` };
    }

    for (const row of createdContacts ?? []) contactIds.add(row.id);
  }

  if (contactIds.size > 0) {
    const { error: linkError } = await supabase.from("campaign_contacts").insert(
      Array.from(contactIds).map((contactId) => ({
        campaign_id: campaign.id,
        contact_id: contactId,
        workspace_id: workspace.id,
      }))
    );

    if (linkError) {
      return { error: `Campaign created, but leads failed to attach: ${linkError.message}` };
    }
  }

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

async function loadOwnedCampaign(campaignId: string) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id)
    .single();
  return { workspace, supabase, campaign };
}

export async function pauseCampaignAction(campaignId: string): Promise<ActionResult> {
  const { supabase, campaign, workspace } = await loadOwnedCampaign(campaignId);
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== "running") {
    return { error: "Only a running campaign can be paused." };
  }
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "paused" satisfies CampaignStatus })
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function resumeCampaignAction(campaignId: string): Promise<ActionResult> {
  const { supabase, campaign, workspace } = await loadOwnedCampaign(campaignId);
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== "paused") {
    return { error: "Only a paused campaign can be resumed." };
  }
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "running" satisfies CampaignStatus })
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function stopCampaignAction(campaignId: string): Promise<ActionResult> {
  const { supabase, campaign, workspace } = await loadOwnedCampaign(campaignId);
  if (!campaign) return { error: "Campaign not found." };
  if (!["running", "paused", "scheduled"].includes(campaign.status)) {
    return { error: "Only a running, paused, or scheduled campaign can be stopped." };
  }
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "stopped" satisfies CampaignStatus, completed_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function deleteCampaignAction(campaignId: string): Promise<ActionResult> {
  const { supabase, campaign, workspace } = await loadOwnedCampaign(campaignId);
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== "draft") {
    return {
      error: "Only draft campaigns can be deleted. Stop an active campaign first, or leave a past campaign in your history.",
    };
  }
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  return {};
}

export async function duplicateCampaignAction(campaignId: string): Promise<ActionResult & { id?: string }> {
  const { supabase, campaign, workspace } = await loadOwnedCampaign(campaignId);
  if (!campaign) return { error: "Campaign not found." };

  const { data: copy, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspace.id,
      agent_id: campaign.agent_id,
      phone_number_id: campaign.phone_number_id,
      name: `${campaign.name} (Copy)`,
      description: campaign.description,
      status: "draft",
      timezone_mode: campaign.timezone_mode,
      fixed_timezone: campaign.fixed_timezone,
      days_of_week: campaign.days_of_week,
      calling_start_time: campaign.calling_start_time,
      calling_end_time: campaign.calling_end_time,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      daily_call_limit: campaign.daily_call_limit,
      concurrency_limit: campaign.concurrency_limit,
      max_attempts: campaign.max_attempts,
      retry_no_answer_minutes: campaign.retry_no_answer_minutes,
      retry_busy_minutes: campaign.retry_busy_minutes,
      retry_failed_minutes: campaign.retry_failed_minutes,
      retry_excluded_statuses: campaign.retry_excluded_statuses,
      voicemail_action: campaign.voicemail_action,
      started_at: null,
      completed_at: null,
    })
    .select("id")
    .single();

  if (error || !copy) return { error: error?.message ?? "Failed to duplicate campaign." };

  revalidatePath("/campaigns");
  return { id: copy.id };
}
