import "server-only";
import twilioLib from "twilio";

import { resolveCredential, resolveTwilioCredentials } from "@/lib/credentials";

export async function getTwilioClientForWorkspace(workspaceId: string) {
  const creds = await resolveTwilioCredentials(workspaceId);
  if (!creds) return null;
  return { client: twilioLib(creds.accountSid, creds.authToken), authToken: creds.authToken };
}

/**
 * Explicitly starts recording via the REST API, called from both voice
 * webhook handlers once the call's `calls` row exists and its signature is
 * verified - rather than relying only on the `record: true` flag passed to
 * calls.create() for outbound calls. Two reasons: (1) that flag only exists
 * on calls WE
 * originate, so inbound calls (answered via the "a call comes in" webhook,
 * never going through calls.create()) got no recording at all; (2) a REST-
 * started recording is the pattern Twilio itself documents for calls using
 * <Connect><Stream> for Media Streams, rather than depending on recording
 * configured before the call is even answered to survive that handoff.
 * Best-effort: a failure here should never block the call itself.
 */
export async function startCallRecording(
  workspaceId: string,
  twilioCallSid: string,
  callId: string,
  baseUrl: string
) {
  const result = await getTwilioClientForWorkspace(workspaceId);
  if (!result) return;
  try {
    await result.client.calls(twilioCallSid).recordings.create({
      recordingStatusCallback: `${baseUrl}/api/webhooks/twilio/recording?callId=${callId}`,
      recordingStatusCallbackEvent: ["completed"],
    });
  } catch (err) {
    console.error(`[call ${callId}] Failed to start recording:`, (err as Error).message);
  }
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

/**
 * Parses a Twilio webhook's form-encoded body. Twilio always sends valid
 * form data, but this is a public, unauthenticated-until-signature-checked
 * endpoint — anyone can POST a malformed body, and `request.formData()`
 * throws on one (e.g. a bad multipart boundary). Returning {} instead of
 * throwing lets callers fall through to their normal "missing required
 * field" 400, rather than an uncaught 500.
 */
export async function parseTwilioForm(request: Request): Promise<Record<string, string>> {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });
    return params;
  } catch {
    return {};
  }
}
