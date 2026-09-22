"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateSystemSettingAction } from "@/app/super-admin/settings/actions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function SystemToggleSetting({
  settingKey,
  label,
  description,
  value,
}: {
  settingKey: string;
  label: string;
  description: string;
  value: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div>
        <Label htmlFor={`setting-${settingKey}`}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={`setting-${settingKey}`}
        checked={value}
        disabled={pending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            const result = await updateSystemSettingAction(settingKey, next);
            if (result.error) toast.error(result.error);
            else toast.success(`${label} ${next ? "enabled" : "disabled"}.`);
          })
        }
      />
    </div>
  );
}
