import "server-only";
import twilioLib from "twilio";

import { resolveCredential, resolveTwilioCredentials } from "@/lib/credentials";

export async function getTwilioClientForWorkspace(workspaceId: string) {
  const creds = await resolveTwilioCredentials(workspaceId);
  if (!creds) return null;
  return { client: twilioLib(creds.accountSid, creds.authToken), authToken: creds.authToken };
}

/**
 * The platform's own Twilio account (integration_credentials scope=platform,
 * set from Super Admin → Settings → APIs), used to search for and buy real
 * numbers on a workspace's behalf — separate from a workspace's own Twilio
 * account, which resolveTwilioCredentials()/getTwilioClientForWorkspace()
 * resolve instead.
 */
export async function getPlatformTwilioClient() {
  const [accountSid, authToken] = await Promise.all([
    resolveCredential(null, "twilio", "account_sid"),
    resolveCredential(null, "twilio", "auth_token"),
  ]);
  if (!accountSid || !authToken) return null;
  return twilioLib(accountSid, authToken);
}

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  capabilities: { voice: boolean; sms: boolean };
}

/** Searches the platform's Twilio account for purchasable US local numbers. */
export async function searchAvailableNumbers(areaCode: string): Promise<AvailableNumber[]> {
  const client = await getPlatformTwilioClient();
  if (!client) throw new Error("Platform Twilio credentials are not configured.");

  const results = await client.availablePhoneNumbers("US").local.list({ areaCode: Number(areaCode), limit: 10 });
  return results.map((r) => ({
    phoneNumber: r.phoneNumber,
    friendlyName: r.friendlyName,
    locality: r.locality ?? null,
    region: r.region ?? null,
    capabilities: { voice: Boolean(r.capabilities?.voice), sms: Boolean(r.capabilities?.sms) },
  }));
}

/** Buys a number on the platform's Twilio account. Does not touch the app's own `phone_numbers` table — the caller inserts that row separately, scoped to whichever workspace it's being assigned to. */
export async function purchaseNumber(phoneNumber: string): Promise<{ sid: string; phoneNumber: string }> {
  const client = await getPlatformTwilioClient();
  if (!client) throw new Error("Platform Twilio credentials are not configured.");

  const purchased = await client.incomingPhoneNumbers.create({ phoneNumber });
  return { sid: purchased.sid, phoneNumber: purchased.phoneNumber };
}

/**
 * Verifies the `X-Twilio-Signature` header against the full request URL and
 * form body, per Twilio's webhook security guide. Every webhook route must
 * call this before trusting anything in the payload.
 */
export function verifyTwilioSignature(
  authToken: string,
  signature: string | null,
  fullUrl: string,
  params: Record<string, string>
): boolean {
  if (!signature) return false;
  return twilioLib.validateRequest(authToken, signature, fullUrl, params);
}

export async function parseTwilioForm(request: Request): Promise<Record<string, string>> {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}
