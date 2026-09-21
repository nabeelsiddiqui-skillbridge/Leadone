import "server-only";
import twilioLib from "twilio";

import { resolveTwilioCredentials } from "@/lib/credentials";

export async function getTwilioClientForWorkspace(workspaceId: string) {
  const creds = await resolveTwilioCredentials(workspaceId);
  if (!creds) return null;
  return { client: twilioLib(creds.accountSid, creds.authToken), authToken: creds.authToken };
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
