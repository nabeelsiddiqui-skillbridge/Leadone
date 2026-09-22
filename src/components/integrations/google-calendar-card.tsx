"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { disconnectGoogleCalendarAction } from "@/app/(app)/integrations/actions";
import { Button } from "@/components/ui/button";

export function GoogleCalendarCard({
  email,
  status,
  calendarId,
}: {
  email: string | null;
  status: "connected" | "expired" | "error" | "disconnected";
  calendarId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectGoogleCalendarAction();
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Disconnected.");
    });
  }

  if (status === "connected" && email) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <p className="font-medium">{email}</p>
          <p className="text-muted-foreground">Calendar: {calendarId ?? "primary"}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleDisconnect}>
          {pending ? "Disconnecting…" : "Disconnect"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {status === "expired" || status === "error" ? (
        <p className="text-sm text-muted-foreground">
          The connection needs to be renewed. Connect again to refresh it.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Not connected. Agents can&apos;t check real availability or book appointments until this
          is set up.
        </p>
      )}
      <Button asChild size="sm" className="w-fit">
        <a href="/api/integrations/google-calendar/connect">Connect Google Calendar</a>
      </Button>
    </div>
  );
}
