"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { updateCallbackStatusAction } from "@/app/(app)/appointments/actions";
import type { Database } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CallbackStatus = Database["public"]["Tables"]["callbacks"]["Row"]["status"];

export function CallbackRowActions({ id, status }: { id: string; status: CallbackStatus }) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: CallbackStatus) {
    startTransition(async () => {
      const result = await updateCallbackStatusAction(id, next);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Callback updated.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== "completed" && (
          <DropdownMenuItem onClick={() => setStatus("completed")}>Mark completed</DropdownMenuItem>
        )}
        {status !== "cancelled" && (
          <DropdownMenuItem variant="destructive" onClick={() => setStatus("cancelled")}>
            Cancel
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
