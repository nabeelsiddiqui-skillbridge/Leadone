"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { WEBHOOK_EVENT_OPTIONS } from "@/components/integrations/webhook-events";

export interface ActionState {
  error?: string;
  message?: string;
}

function requireAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    return "Only a workspace owner or admin can change this.";
  }
  return null;
}

/**
 * Encrypts and upserts one workspace-scope credential row. Never returns the
 * plaintext; callers must reload from the server (masked via last4) to
 * confirm the save.
 */
async function upsertWorkspaceCredential(
  workspaceId: string,
  provider: "twilio" | "openai" | "google" | "smtp" | "webhook",
  keyName: string,
  plaintext: string
) {
  const supabase = await createClient();
  const { ciphertext, iv } = encryptSecret(plaintext);
  const last4 = plaintext.slice(-4);

  const { data: existing } = await supabase
    .from("integration_credentials")
    .select("id")
    .eq("scope", "workspace")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("key_name", keyName)
    .maybeSingle();

  if (existing) {
    return supabase
      .from("integration_credentials")
      .update({ ciphertext, iv, last4 })
      .eq("id", existing.id);
  }

  return supabase.from("integration_credentials").insert({
    scope: "workspace",
    workspace_id: workspaceId,
    provider,
    key_name: keyName,
    ciphertext,
    iv,
    last4,
  });
}

export async function saveTwilioCredentialsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace, role } = await requireCurrentWorkspace();
  const adminError = requireAdmin(role);
  if (adminError) return { error: adminError };

  const accountSid = String(formData.get("account_sid") ?? "").trim();
  const authToken = String(formData.get("auth_token") ?? "").trim();

  if (!accountSid || !authToken) {
    return { error: "Both Account SID and Auth Token are required." };
  }

  const [sidResult, tokenResult] = await Promise.all([
    upsertWorkspaceCredential(workspace.id, "twilio", "account_sid", accountSid),
    upsertWorkspaceCredential(workspace.id, "twilio", "auth_token", authToken),
  ]);

  if (sidResult.error || tokenResult.error) {
    return { error: sidResult.error?.message ?? tokenResult.error?.message };
  }

  revalidatePath("/integrations");
  return { message: "Twilio credentials saved for this workspace." };
}

export async function saveOpenAiCredentialAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace, role } = await requireCurrentWorkspace();
  const adminError = requireAdmin(role);
  if (adminError) return { error: adminError };

  const apiKey = String(formData.get("api_key") ?? "").trim();
  if (!apiKey) return { error: "API key is required." };

  const { error } = await upsertWorkspaceCredential(workspace.id, "openai", "api_key", apiKey);
  if (error) return { error: error.message };

  revalidatePath("/integrations");
  return { message: "OpenAI key saved for this workspace." };
}

/** Deletes any workspace-scope override(s) for a provider, falling back to the platform/env default. */
export async function clearWorkspaceCredentialAction(
  provider: "twilio" | "openai"
): Promise<ActionState> {
  const { workspace, role } = await requireCurrentWorkspace();
  const adminError = requireAdmin(role);
  if (adminError) return { error: adminError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("integration_credentials")
    .delete()
    .eq("scope", "workspace")
    .eq("workspace_id", workspace.id)
    .eq("provider", provider);

  if (error) return { error: error.message };

  revalidatePath("/integrations");
  return { message: "Reverted to the platform default." };
}

export async function disconnectGoogleCalendarAction(): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  // Disconnect = mark the row disconnected and clear the tokens, rather than
  // deleting the row outright, so the workspace's calendar connection
  // history (email, when it was connected) is still visible in the UI. A
  // fresh Connect always re-upserts this same row.
  const { error } = await supabase
    .from("calendar_connections")
    .update({
      status: "disconnected",
      access_token_ciphertext: null,
      refresh_token_ciphertext: null,
      token_iv: null,
      expires_at: null,
    })
    .eq("workspace_id", workspace.id)
    .eq("provider", "google");

  if (error) return { error: error.message };

  revalidatePath("/integrations");
  return { message: "Google Calendar disconnected." };
}

export async function addWebhookAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const url = String(formData.get("url") ?? "").trim();
  const validEvents = new Set(WEBHOOK_EVENT_OPTIONS.map((o) => o.value as string));
  const events = formData.getAll("events").map(String).filter((e) => validEvents.has(e));

  if (!url) return { error: "A URL is required." };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { error: "URL must be http(s)." };
    }
  } catch {
    return { error: "Enter a valid URL." };
  }
  if (events.length === 0) {
    return { error: "Choose at least one event." };
  }

  const { error } = await supabase.from("webhooks").insert({
    workspace_id: workspace.id,
    url,
    events,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath("/integrations");
  return { message: "Webhook added." };
}

export async function toggleWebhookStatusAction(id: string, nextStatus: "active" | "disabled") {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  await supabase
    .from("webhooks")
    .update({ status: nextStatus })
    .eq("workspace_id", workspace.id)
    .eq("id", id);

  revalidatePath("/integrations");
}

export async function removeWebhookAction(id: string) {
  const { workspace, role } = await requireCurrentWorkspace();
  const adminError = requireAdmin(role);
  if (adminError) return { error: adminError };

  const supabase = await createClient();
  await supabase.from("webhooks").delete().eq("workspace_id", workspace.id).eq("id", id);

  revalidatePath("/integrations");
  return {};
}
