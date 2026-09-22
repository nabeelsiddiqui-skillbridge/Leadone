"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setFeatureFlagAction } from "@/app/super-admin/settings/actions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function FeatureFlagToggle({
  flagKey,
  description,
  enabled,
}: {
  flagKey: string;
  description: string | null;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div>
        <Label htmlFor={`flag-${flagKey}`} className="font-mono text-sm">
          {flagKey}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch
        id={`flag-${flagKey}`}
        checked={enabled}
        disabled={pending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            const result = await setFeatureFlagAction(flagKey, next);
            if (result.error) toast.error(result.error);
          })
        }
      />
    </div>
  );
}
