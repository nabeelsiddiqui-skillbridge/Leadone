"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CampaignStatus, Database } from "@/lib/supabase/database.types";

type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];

export interface AdminActionResult {
  error?: string;
  message?: string;
}

const ALLOWED_TRANSITIONS: Record<string, CampaignStatus[]> = {
  pause: ["running"],
  resume: ["paused"],
  stop: ["running", "paused", "scheduled"],
};

const NEXT_STATUS: Record<keyof typeof ALLOWED_TRANSITIONS, CampaignStatus> = {
  pause: "paused",
  resume: "running",
  stop: "stopped",
};

export async function setCampaignStatusAction(
  campaignId: string,
  action: "pause" | "resume" | "stop"
): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: campaign, error: fetchError } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .single();
  if (fetchError || !campaign) return { error: "Campaign not found." };

  if (!ALLOWED_TRANSITIONS[action].includes(campaign.status)) {
    return { error: `Cannot ${action} a campaign that is currently ${campaign.status}.` };
  }

  const nextStatus = NEXT_STATUS[action];
  const patch: CampaignUpdate = { status: nextStatus };
  if (action === "stop") patch.completed_at = new Date().toISOString();

  const { error } = await supabase.from("campaigns").update(patch).eq("id", campaignId);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: `campaign.${action}`,
    target_type: "campaign",
    target_id: campaignId,
    metadata: { previous_status: campaign.status, new_status: nextStatus },
  });

  revalidatePath("/super-admin/campaigns");
  return { message: `Campaign ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "stopped"}.` };
}
