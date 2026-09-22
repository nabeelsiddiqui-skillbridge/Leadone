import { NextResponse } from "next/server";
import { google } from "googleapis";

import { requireCurrentWorkspace } from "@/lib/auth";

export const runtime = "nodejs";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Kicks off the Google Calendar OAuth consent flow for the caller's
 * workspace. Always builds and redirects to a real Google consent URL, even
 * when GOOGLE_CLIENT_ID/SECRET aren't set in this environment — Google will
 * itself reject an invalid/missing client id at its end, which is expected
 * here. The Integrations page is where we show a friendly "not configured"
 * notice; this route stays a straight, always-functional redirect so the
 * flow works the moment real credentials are added, with no code change.
 *
 * The workspace id is embedded as the OAuth `state` param. It is not a
 * secret — the callback re-derives the caller's own workspace via
 * requireCurrentWorkspace() and only uses `state` as a CSRF check, rejecting
 * the callback if the two don't match.
 */
export async function GET(request: Request) {
  const { workspace } = await requireCurrentWorkspace();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: workspace.id,
  });

  return NextResponse.redirect(authUrl);
}
