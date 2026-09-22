"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateSystemSettingAction } from "@/app/super-admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Json } from "@/lib/supabase/database.types";

export interface JsonField {
  key: string;
  label: string;
  type?: "text" | "number";
}

export function JsonSettingsForm({
  settingKey,
  fields,
  value,
}: {
  settingKey: string;
  fields: JsonField[];
  value: Record<string, unknown>;
}) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(value[f.key] ?? "")]))
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        payload[field.key] = field.type === "number" ? Number(form[field.key] || 0) : form[field.key];
      }
      const result = await updateSystemSettingAction(settingKey, payload as Json);
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Saved.");
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={`${settingKey}-${field.key}`} className="text-xs">
              {field.label}
            </Label>
            <Input
              id={`${settingKey}-${field.key}`}
              type={field.type === "number" ? "number" : "text"}
              value={form[field.key] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button size="sm" className="w-fit" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
