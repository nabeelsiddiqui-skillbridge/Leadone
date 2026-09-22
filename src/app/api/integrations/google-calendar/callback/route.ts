import { NextResponse } from "next/server";
import { google } from "googleapis";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * Token storage shape (see also services/realtime-voice/src/tools/calendar.ts):
 *
 * AES-256-GCM requires a given (key, iv) pair never encrypt two different
 * plaintexts. calendar_connections has a single `token_iv` column shared by
 * both token ciphertext columns, so encrypting access_token and
 * refresh_token separately (each producing its own iv, but persisted into
 * one shared iv column) would either reuse an iv or silently drop one of
 * them. Instead we encrypt ONE combined JSON string,
 * `{ access_token, refresh_token }`, as a single plaintext/iv pair, and
 * store it in `access_token_ciphertext` + `token_iv`. `refresh_token_ciphertext`
 * is left null — it's unused under this scheme, kept only for schema
 * compatibility. The realtime-voice service's getGoogleClient() has been
 * updated to decrypt + JSON.parse this combined value to match.
 */
function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const { workspace } = await requireCurrentWorkspace();
  const url = new URL(request.url);

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return redirectTo(request, `/integrations?error=${encodeURIComponent(oauthError)}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return redirectTo(request, "/integrations?error=google_calendar_missing_code");
  }

  // CSRF check: the state minted by /connect must match the workspace this
  // authenticated session actually belongs to.
  if (!state || state !== workspace.id) {
    return redirectTo(request, "/integrations?error=google_calendar_state_mismatch");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectTo(request, "/integrations?error=google_calendar_not_configured");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  let accessToken: string | null | undefined;
  let refreshToken: string | null | undefined;
  let expiryDate: number | null | undefined;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    expiryDate = tokens.expiry_date;
    oauth2Client.setCredentials(tokens);
  } catch {
    return redirectTo(request, "/integrations?error=google_calendar_token_exchange_failed");
  }

  if (!accessToken || !refreshToken) {
    // We always pass prompt: "consent" from /connect, so a refresh token
    // should come back; if it doesn't, we can't do offline access later.
    return redirectTo(request, "/integrations?error=google_calendar_missing_tokens");
  }

  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    email = data.email ?? null;
  } catch {
    // Non-fatal — the connection still works without a stored email.
  }

  const { ciphertext, iv } = encryptSecret(
    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
  );

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("calendar_connections")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("provider", "google")
    .maybeSingle();

  const row = {
    workspace_id: workspace.id,
    provider: "google" as const,
    email,
    calendar_id: "primary",
    access_token_ciphertext: ciphertext,
    refresh_token_ciphertext: null,
    token_iv: iv,
    expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
    status: "connected" as const,
  };

  const { error } = existing
    ? await supabase.from("calendar_connections").update(row).eq("id", existing.id)
    : await supabase.from("calendar_connections").insert(row);

  if (error) {
    return redirectTo(request, `/integrations?error=${encodeURIComponent(error.message)}`);
  }

  return redirectTo(request, "/integrations?connected=google_calendar");
}
