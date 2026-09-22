"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveOpenAiCredentialAction, clearWorkspaceCredentialAction } from "@/app/(app)/integrations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function OpenAiCredentialForm({
  isAdmin,
  apiKeyLast4,
  hasOverride,
}: {
  isAdmin: boolean;
  apiKeyLast4: string | null;
  hasOverride: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clearing, startClearing] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveOpenAiCredentialAction({}, formData);
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
      const result = await clearWorkspaceCredentialAction("openai");
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Reverted.");
    });
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        {hasOverride
          ? "This workspace has its own OpenAI key on file. Ask an owner or admin to change it."
          : "Using the platform default OpenAI key. Ask an owner or admin to add a workspace-specific one."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasOverride && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>Using workspace override — key ending {apiKeyLast4 ?? "····"}.</span>
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
          <Label htmlFor="openai_api_key">API key</Label>
          <Input
            id="openai_api_key"
            name="api_key"
            type="password"
            placeholder={hasOverride ? "Enter a new key to replace it" : "sk-..."}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending} className="w-fit">
          {pending ? "Saving…" : hasOverride ? "Update key" : "Save for this workspace"}
        </Button>
      </form>
    </div>
  );
}
