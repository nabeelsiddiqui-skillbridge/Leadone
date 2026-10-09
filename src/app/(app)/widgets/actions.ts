"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { WidgetSize } from "@/lib/supabase/database.types";

export interface ActionState {
  error?: string;
  message?: string;
}

const SIZES: WidgetSize[] = ["compact", "standard", "large"];
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function cleanString(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

interface WidgetFormValues {
  name: string;
  size: WidgetSize;
  primary_color: string;
  greeting_message: string;
  agent_id: string | null;
  chat_enabled: boolean;
  voice_chat_enabled: boolean;
}

function widgetFieldsFromForm(formData: FormData): { error?: string; fields?: WidgetFormValues } {
  const name = cleanString(formData.get("name"));
  const size = String(formData.get("size") ?? "");
  const primaryColor = String(formData.get("primary_color") ?? "").trim();
  const greetingMessage = cleanString(formData.get("greeting_message"));
  const agentId = cleanString(formData.get("agent_id"));
  const chatEnabled = String(formData.get("chat_enabled") ?? "off") === "on";
  const voiceChatEnabled = String(formData.get("voice_chat_enabled") ?? "off") === "on";

  if (!name) return { error: "Name is required." };
  if (!SIZES.includes(size as WidgetSize)) return { error: "Choose a valid size." };
  if (!HEX_COLOR_RE.test(primaryColor)) return { error: "Enter a valid hex color, e.g. #1B4D3E." };
  if (!chatEnabled && !voiceChatEnabled) return { error: "Turn on at least chat or voice chat." };

  return {
    fields: {
      name,
      size: size as WidgetSize,
      primary_color: primaryColor,
      greeting_message: greetingMessage ?? "Hi! How can we help you today?",
      agent_id: agentId,
      chat_enabled: chatEnabled,
      voice_chat_enabled: voiceChatEnabled,
    },
  };
}

export async function createWidgetAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error, fields } = widgetFieldsFromForm(formData);
  if (error || !fields) return { error };

  const { data, error: insertError } = await supabase
    .from("chat_widgets")
    .insert({ workspace_id: workspace.id, ...fields })
    .select("id")
    .single();

  if (insertError || !data) {
    return { error: insertError?.message ?? "Failed to create widget." };
  }

  revalidatePath("/widgets");
  return { message: data.id };
}

export async function updateWidgetAction(
  widgetId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error, fields } = widgetFieldsFromForm(formData);
  if (error || !fields) return { error };

  const { error: updateError } = await supabase
    .from("chat_widgets")
    .update(fields)
    .eq("id", widgetId)
    .eq("workspace_id", workspace.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/widgets");
  revalidatePath(`/widgets/${widgetId}`);
  return { message: "Widget saved." };
}

export async function toggleWidgetStatusAction(widgetId: string, nextStatus: "active" | "inactive") {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chat_widgets")
    .update({ status: nextStatus })
    .eq("id", widgetId)
    .eq("workspace_id", workspace.id);

  revalidatePath("/widgets");
  return { error: error?.message };
}

export async function deleteWidgetAction(widgetId: string): Promise<{ error?: string }> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chat_widgets")
    .delete()
    .eq("id", widgetId)
    .eq("workspace_id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/widgets");
  return {};
}
