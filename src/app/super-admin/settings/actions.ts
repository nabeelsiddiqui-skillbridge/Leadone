"use server";

import { revalidatePath } from "next/cache";
import twilioLib from "twilio";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { encryptSecret, maskSecret } from "@/lib/crypto";
import { resolveCredential } from "@/lib/credentials";
import type { Json } from "@/lib/supabase/database.types";

export interface AdminActionResult {
  error?: string;
  message?: string;
}

async function auditLog(adminId: string, action: string, targetType: string, targetId: string, metadata: Json) {
  const db = createServiceRoleClient();
  await db.from("admin_audit_logs").insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, metadata });
}

/**
 * Saves a platform-scope credential (scope='platform', workspace_id=null).
 * Only ever stores the encrypted ciphertext + a last4 for display - the
 * plaintext never round-trips back to the browser after this call returns.
 */
export async function savePlatformCredentialAction(
  provider: "openai" | "twilio",
  keyName: string,
  plaintext: string
): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  if (!plaintext.trim()) return { error: "Value is required." };

  const db = createServiceRoleClient();
  const { ciphertext, iv } = encryptSecret(plaintext.trim());
  const last4 = plaintext.trim().slice(-4);

  const { error } = await db.from("integration_credentials").upsert(
    {
      scope: "platform",
      workspace_id: null,
      provider,
      key_name: keyName,
      ciphertext,
      iv,
      last4,
      created_by: admin.id,
    },
    { onConflict: "scope,workspace_id,provider,key_name" }
  );

  if (error) return { error: error.message };

  await auditLog(admin.id, "platform_credential.save", "integration_credential", `${provider}:${keyName}`, {});
  revalidatePath("/super-admin/settings/apis");
  return { message: `Saved. Now ${maskSecret(plaintext.trim())}` };
}

export async function deletePlatformCredentialAction(provider: "openai" | "twilio", keyName: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { error } = await db
    .from("integration_credentials")
    .delete()
    .eq("scope", "platform")
    .is("workspace_id", null)
    .eq("provider", provider)
    .eq("key_name", keyName);

  if (error) return { error: error.message };

  await auditLog(admin.id, "platform_credential.delete", "integration_credential", `${provider}:${keyName}`, {});
  revalidatePath("/super-admin/settings/apis");
  return { message: "Removed. This provider will fall back to its environment variable, if set." };
}

export async function testOpenAiConnectionAction(): Promise<AdminActionResult> {
  const key = await resolveCredential(null, "openai", "api_key");
  if (!key) return { error: "No OpenAI key configured (platform credential or OPENAI_API_KEY env var)." };

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) {
      const body = await response.text();
      return { error: `OpenAI rejected the key (${response.status}): ${body.slice(0, 200)}` };
    }
    return { message: "OpenAI connection verified." };
  } catch (err) {
    return { error: `Could not reach OpenAI: ${(err as Error).message}` };
  }
}

export async function testTwilioConnectionAction(): Promise<AdminActionResult> {
  const [accountSid, authToken] = await Promise.all([
    resolveCredential(null, "twilio", "account_sid"),
    resolveCredential(null, "twilio", "auth_token"),
  ]);
  if (!accountSid || !authToken) {
    return { error: "No Twilio credentials configured (platform credentials or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN env vars)." };
  }

  try {
    const client = twilioLib(accountSid, authToken);
    const account = await client.api.v2010.accounts(accountSid).fetch();
    return { message: `Twilio connection verified (account: ${account.friendlyName}).` };
  } catch (err) {
    return { error: `Twilio rejected the credentials: ${(err as Error).message}` };
  }
}

export async function updateSystemSettingAction(key: string, value: Json): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { error } = await db
    .from("system_settings")
    .upsert({ key, value, updated_by: admin.id }, { onConflict: "key" });

  if (error) return { error: error.message };

  await auditLog(admin.id, "system_setting.update", "system_setting", key, { value });
  revalidatePath("/super-admin/settings/apis");
  return { message: "Saved." };
}

export async function setFeatureFlagAction(key: string, enabled: boolean): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { error } = await db.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) return { error: error.message };

  await auditLog(admin.id, "feature_flag.toggle", "feature_flag", key, { enabled });
  revalidatePath("/super-admin/settings/apis");
  return { message: `${key} ${enabled ? "enabled" : "disabled"}.` };
}

export async function updatePricingAction(provider: string, unit: string, unitCostMicros: number): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { error } = await db
    .from("pricing_settings")
    .upsert(
      { provider, unit, unit_cost_micros: unitCostMicros, updated_at: new Date().toISOString() },
      { onConflict: "provider,unit" }
    );
  if (error) return { error: error.message };

  await auditLog(admin.id, "pricing.update", "pricing_setting", `${provider}:${unit}`, { unit_cost_micros: unitCostMicros });
  revalidatePath("/super-admin/settings/apis");
  return { message: "Pricing updated." };
}
