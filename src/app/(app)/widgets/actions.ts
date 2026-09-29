"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { WidgetMode, WidgetSize } from "@/lib/supabase/database.types";

export interface ActionState {
  error?: string;
  message?: string;
}

const MODES: WidgetMode[] = ["chat", "call", "both"];
const SIZES: WidgetSize[] = ["compact", "standard", "large"];
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function cleanString(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

interface WidgetFormValues {
  name: string;
  mode: WidgetMode;
  size: WidgetSize;
  primary_color: string;
  greeting_message: string;
  agent_id: string | null;
}

function widgetFieldsFromForm(formData: FormData): { error?: string; fields?: WidgetFormValues } {
  const name = cleanString(formData.get("name"));
  const mode = String(formData.get("mode") ?? "");
  const size = String(formData.get("size") ?? "");
  const primaryColor = String(formData.get("primary_color") ?? "").trim();
  const greetingMessage = cleanString(formData.get("greeting_message"));
  const agentId = cleanString(formData.get("agent_id"));

  if (!name) return { error: "Name is required." };
  if (!MODES.includes(mode as WidgetMode)) return { error: "Choose a valid mode." };
  if (!SIZES.includes(size as WidgetSize)) return { error: "Choose a valid size." };
  if (!HEX_COLOR_RE.test(primaryColor)) return { error: "Enter a valid hex color, e.g. #1B4D3E." };

  return {
    fields: {
      name,
      mode: mode as WidgetMode,
      size: size as WidgetSize,
      primary_color: primaryColor,
      greeting_message: greetingMessage ?? "Hi! How can we help you today?",
      agent_id: agentId,
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
