"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function TestConnectionButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<{ error?: string; message?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result.error) toast.error(result.error);
          else toast.success(result.message ?? "Connection verified.");
        })
      }
    >
      {pending ? "Testing…" : label}
    </Button>
  );
}
