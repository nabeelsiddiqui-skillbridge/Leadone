"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export interface ActionState {
  error?: string;
  message?: string;
}

export interface CallingDefaults {
  default_timezone?: string;
  calling_hours_start?: string;
  calling_hours_end?: string;
  max_concurrent_calls?: number;
  default_phone_number_id?: string | null;
  recording_enabled?: boolean;
}

export async function updateWorkspaceNameAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace, role } = await requireCurrentWorkspace();
  if (role !== "owner" && role !== "admin") {
    return { error: "Only workspace owners or admins can rename the workspace." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Workspace name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").update({ name }).eq("id", workspace.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { message: "Workspace name updated." };
}

export async function updateCallingDefaultsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const existing = (workspace.settings as Record<string, Json> | null) ?? {};
  const calling: CallingDefaults = {
    default_timezone: String(formData.get("default_timezone") ?? "UTC"),
    calling_hours_start: String(formData.get("calling_hours_start") ?? "09:00"),
    calling_hours_end: String(formData.get("calling_hours_end") ?? "17:00"),
    max_concurrent_calls: Number(formData.get("max_concurrent_calls") ?? 3),
    recording_enabled: formData.get("recording_enabled") === "on",
  };

  const nextSettings = { ...existing, calling } as unknown as Json;

  const { error } = await supabase.from("workspaces").update({ settings: nextSettings }).eq("id", workspace.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { message: "Calling defaults saved." };
}

export async function addDoNotCallAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const phone = String(formData.get("phone") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!phone) return { error: "Phone number is required." };

  const { error } = await supabase.from("do_not_call").insert({
    workspace_id: workspace.id,
    phone,
    reason,
  });

  if (error) {
    return { error: error.code === "23505" ? "That number is already on the Do Not Call list." : error.message };
  }

  revalidatePath("/settings/do-not-call");
  return { message: "Number added to the Do Not Call list." };
}

export async function removeDoNotCallAction(id: string): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.from("do_not_call").delete().eq("workspace_id", workspace.id).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/settings/do-not-call");
  return { message: "Removed from the Do Not Call list. This does not change any contact's current status." };
}
