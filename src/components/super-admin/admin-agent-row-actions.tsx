"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { duplicateAgentForTestingAction, setAgentStatusAction } from "@/app/super-admin/agents/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AdminAgentRowActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Done.");
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
        <DropdownMenuItem
          onClick={() => run(() => setAgentStatusAction(id, status === "active" ? "inactive" : "active"))}
        >
          {status === "active" ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => duplicateAgentForTestingAction(id))}>
          Duplicate for testing
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
