import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { decryptSecret } from "@/lib/crypto";

export type CredentialProvider = "openai" | "twilio" | "google" | "smtp" | "webhook";

/** process.env fallback used to bootstrap the platform before an admin sets a DB-stored key. */
const ENV_FALLBACKS: Partial<Record<`${CredentialProvider}:${string}`, string>> = {
  "openai:api_key": process.env.OPENAI_API_KEY,
  "twilio:account_sid": process.env.TWILIO_ACCOUNT_SID,
  "twilio:auth_token": process.env.TWILIO_AUTH_TOKEN,
  "google:client_id": process.env.GOOGLE_CLIENT_ID,
  "google:client_secret": process.env.GOOGLE_CLIENT_SECRET,
};

/**
 * Resolves a provider credential with workspace override > platform default
 * > env var bootstrap, per the platform/workspace credential architecture.
 * Never returns the raw DB row — only the decrypted secret string (or the
 * env fallback), and only to server-only callers.
 */
export async function resolveCredential(
  workspaceId: string | null,
  provider: CredentialProvider,
  keyName: string
): Promise<string | null> {
  const db = createServiceRoleClient();

  if (workspaceId) {
    const { data: workspaceCred } = await db
      .from("integration_credentials")
      .select("ciphertext, iv")
      .eq("scope", "workspace")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .eq("key_name", keyName)
      .maybeSingle();

    if (workspaceCred) {
      return decryptSecret({ ciphertext: workspaceCred.ciphertext, iv: workspaceCred.iv });
    }
  }

  const { data: platformCred } = await db
    .from("integration_credentials")
    .select("ciphertext, iv")
    .eq("scope", "platform")
    .is("workspace_id", null)
    .eq("provider", provider)
    .eq("key_name", keyName)
    .maybeSingle();

  if (platformCred) {
    return decryptSecret({ ciphertext: platformCred.ciphertext, iv: platformCred.iv });
  }

  return ENV_FALLBACKS[`${provider}:${keyName}`] ?? null;
}

export async function resolveTwilioCredentials(workspaceId: string) {
  const [accountSid, authToken] = await Promise.all([
    resolveCredential(workspaceId, "twilio", "account_sid"),
    resolveCredential(workspaceId, "twilio", "auth_token"),
  ]);
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
}
