"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const CONNECTED_LABELS: Record<string, string> = {
  google_calendar: "Google Calendar connected.",
};

const ERROR_LABELS: Record<string, string> = {
  google_calendar_not_configured: "Google Calendar isn't configured (missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI).",
  google_calendar_missing_code: "Google didn't return an authorization code.",
  google_calendar_state_mismatch: "That authorization link didn't match your session. Try connecting again.",
  google_calendar_token_exchange_failed: "Google rejected the authorization code.",
  google_calendar_missing_tokens: "Google didn't return the tokens we need. Try disconnecting and reconnecting.",
};

/** Fires a toast once for the connected=/error= query params set by the Google Calendar OAuth callback. */
export function IntegrationsAlerts({
  connected,
  error,
}: {
  connected?: string;
  error?: string;
}) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    if (connected) {
      toast.success(CONNECTED_LABELS[connected] ?? "Connected.");
    } else if (error) {
      toast.error(ERROR_LABELS[error] ?? error);
    }
  }, [connected, error]);

  return null;
}
