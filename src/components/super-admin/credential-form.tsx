"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  savePlatformCredentialAction,
  deletePlatformCredentialAction,
} from "@/app/super-admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function CredentialForm({
  provider,
  keyName,
  label,
  placeholder,
  currentLast4,
  envFallbackConfigured,
}: {
  provider: "openai" | "twilio";
  keyName: string;
  label: string;
  placeholder: string;
  currentLast4: string | null;
  envFallbackConfigured: boolean;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const status = currentLast4
    ? `Set in database (…${currentLast4})`
    : envFallbackConfigured
      ? "Using environment variable fallback"
      : "Not configured";

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge variant={currentLast4 || envFallbackConfigured ? "success" : "secondary"}>{status}</Badge>
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
        />
        <Button
          size="sm"
          disabled={pending || !value.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await savePlatformCredentialAction(provider, keyName, value);
              if (result.error) toast.error(result.error);
              else {
                toast.success(result.message ?? "Saved.");
                setValue("");
              }
            })
          }
        >
          Save
        </Button>
        {currentLast4 && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deletePlatformCredentialAction(provider, keyName);
                if (result.error) toast.error(result.error);
                else toast.success(result.message ?? "Removed.");
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
