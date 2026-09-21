"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteAgentAction,
  duplicateAgentAction,
  setAgentStatusAction,
} from "@/app/(app)/agents/actions";
import type { AgentStatus } from "@/lib/supabase/database.types";

export function AgentRowActions({ id, status }: { id: string; status: AgentStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const nextStatus: Extract<AgentStatus, "active" | "inactive"> =
    status === "active" ? "inactive" : "active";

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateAgentAction(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Agent duplicated.");
      router.refresh();
    });
  }

  function handleToggleStatus() {
    startTransition(async () => {
      const result = await setAgentStatusAction(id, nextStatus);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(nextStatus === "active" ? "Agent activated." : "Agent deactivated.");
      router.refresh();
    });
  }

  function handleDelete() {
    if (typeof window !== "undefined" && !window.confirm("Delete this agent? This cannot be undone.")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteAgentAction(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Agent deleted.");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label="Agent actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/agents/${id}`}>Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleDuplicate();
          }}
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/agents/${id}#test-agent`}>Test Agent</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleToggleStatus();
          }}
        >
          {nextStatus === "active" ? "Activate" : "Deactivate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            handleDelete();
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
