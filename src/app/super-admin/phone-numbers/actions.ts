"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { searchAvailableNumbers, purchaseNumber, type AvailableNumber } from "@/lib/twilio";

export interface AdminActionResult {
  error?: string;
  message?: string;
}

export interface SearchNumbersResult extends AdminActionResult {
  numbers?: AvailableNumber[];
}

export async function searchNumbersAction(areaCode: string): Promise<SearchNumbersResult> {
  await requireSuperAdmin();

  if (!/^\d{3}$/.test(areaCode)) {
    return { error: "Enter a 3-digit US area code." };
  }

  try {
    const numbers = await searchAvailableNumbers(areaCode);
    if (numbers.length === 0) {
      return { message: "No numbers available for that area code.", numbers: [] };
    }
    return { numbers };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to search Twilio." };
  }
}

/**
 * Buys the number on the platform's Twilio account, then assigns it to the
 * target workspace by inserting a phone_numbers row for it. If the insert
 * fails after a successful purchase, the number is still bought (and billed
 * by Twilio) but unassigned - surfaced to the admin so they can retry the
 * assignment or release the number manually rather than losing track of it.
 */
export async function purchaseAndAssignAction(
  phoneNumber: string,
  workspaceId: string,
  friendlyName: string
): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { data: workspace } = await db.from("workspaces").select("id, name").eq("id", workspaceId).single();
  if (!workspace) return { error: "Workspace not found." };

  let purchased: { sid: string; phoneNumber: string };
  try {
    purchased = await purchaseNumber(phoneNumber);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to purchase number from Twilio." };
  }

  const { count } = await db
    .from("phone_numbers")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const { error: insertError } = await db.from("phone_numbers").insert({
    workspace_id: workspaceId,
    phone_number: purchased.phoneNumber,
    friendly_name: friendlyName || null,
    twilio_sid: purchased.sid,
    country: "US",
    status: "active",
    is_default: (count ?? 0) === 0,
  });

  if (insertError) {
    return {
      error: `Number ${purchased.phoneNumber} was purchased on Twilio (SID ${purchased.sid}) but could not be assigned to ${workspace.name}: ${insertError.message}`,
    };
  }

  await db.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "phone_number.purchase_assign",
    target_type: "workspace",
    target_id: workspaceId,
    metadata: { phone_number: purchased.phoneNumber, twilio_sid: purchased.sid },
  });

  revalidatePath("/super-admin/phone-numbers");
  return { message: `Purchased ${purchased.phoneNumber} and assigned it to ${workspace.name}.` };
}
