"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveTwilioCredentialsAction, clearWorkspaceCredentialAction } from "@/app/(app)/integrations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TwilioCredentialForm({
  isAdmin,
  accountSidLast4,
  authTokenLast4,
  hasOverride,
}: {
  isAdmin: boolean;
  accountSidLast4: string | null;
  authTokenLast4: string | null;
  hasOverride: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clearing, startClearing] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveTwilioCredentialsAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      formRef.current?.reset();
    });
  }

  function handleClear() {
    startClearing(async () => {
      const result = await clearWorkspaceCredentialAction("twilio");
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Reverted.");
    });
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        {hasOverride
          ? "This workspace has its own Twilio credentials on file. Ask an owner or admin to change them."
          : "Using the platform default Twilio credentials. Ask an owner or admin to add workspace-specific ones."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasOverride && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>
            Using workspace override — Account SID ending {accountSidLast4 ?? "····"}, Auth Token
            ending {authTokenLast4 ?? "····"}.
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={clearing} onClick={handleClear}>
            {clearing ? "Reverting…" : "Revert to platform default"}
          </Button>
        </div>
      )}
      <form ref={formRef} action={handleSubmit} className="grid gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="twilio_account_sid">Account SID</Label>
          <Input
            id="twilio_account_sid"
            name="account_sid"
            placeholder={hasOverride ? "Enter a new value to replace it" : "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="twilio_auth_token">Auth Token</Label>
          <Input
            id="twilio_auth_token"
            name="auth_token"
            type="password"
            placeholder={hasOverride ? "Enter a new value to replace it" : "Your Twilio auth token"}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending} className="w-fit">
          {pending ? "Saving…" : hasOverride ? "Update credentials" : "Save for this workspace"}
        </Button>
      </form>
    </div>
  );
}
