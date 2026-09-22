"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { removeDoNotCallAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

export function RemoveDncButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeDoNotCallAction(id);
          if (result.error) toast.error(result.error);
          else toast.success(result.message ?? "Removed.");
        })
      }
    >
      <X className="size-4" />
    </Button>
  );
}
