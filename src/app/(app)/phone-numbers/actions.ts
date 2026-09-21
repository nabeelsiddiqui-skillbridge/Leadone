"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  message?: string;
}

function normalizePhone(raw: string) {
  return raw.trim();
}

export async function addPhoneNumberAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const phone_number = normalizePhone(String(formData.get("phone_number") ?? ""));
  const friendly_name = String(formData.get("friendly_name") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || null;

  if (!phone_number) {
    return { error: "Phone number is required." };
  }
  if (!/^\+?[1-9]\d{6,14}$/.test(phone_number.replace(/[\s()-]/g, ""))) {
    return { error: "Enter a valid phone number in E.164 format, e.g. +14155551234." };
  }

  const { count } = await supabase
    .from("phone_numbers")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  const { error } = await supabase.from("phone_numbers").insert({
    workspace_id: workspace.id,
    phone_number,
    friendly_name,
    country,
    is_default: (count ?? 0) === 0,
    status: "active",
  });

  if (error) {
    return { error: error.code === "23505" ? "That number is already on this workspace." : error.message };
  }

  revalidatePath("/phone-numbers");
  return { message: "Phone number added." };
}

export async function setDefaultPhoneNumberAction(id: string) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  await supabase.from("phone_numbers").update({ is_default: false }).eq("workspace_id", workspace.id);
  await supabase
    .from("phone_numbers")
    .update({ is_default: true })
    .eq("workspace_id", workspace.id)
    .eq("id", id);

  revalidatePath("/phone-numbers");
}

export async function togglePhoneNumberStatusAction(id: string, nextStatus: "active" | "inactive") {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  await supabase
    .from("phone_numbers")
    .update({ status: nextStatus })
    .eq("workspace_id", workspace.id)
    .eq("id", id);

  revalidatePath("/phone-numbers");
}

export async function removePhoneNumberAction(id: string) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { count } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("phone_number_id", id);

  if (count && count > 0) {
    return { error: `This number is used by ${count} campaign(s). Unassign it from those campaigns first.` };
  }

  await supabase.from("phone_numbers").delete().eq("workspace_id", workspace.id).eq("id", id);
  revalidatePath("/phone-numbers");
  return {};
}
