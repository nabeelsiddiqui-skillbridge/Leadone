"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setCampaignStatusAction } from "@/app/super-admin/campaigns/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AdminCampaignRowActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();

  function run(action: "pause" | "resume" | "stop") {
    startTransition(async () => {
      const result = await setCampaignStatusAction(id, action);
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
        {status === "running" && <DropdownMenuItem onClick={() => run("pause")}>Pause</DropdownMenuItem>}
        {status === "paused" && <DropdownMenuItem onClick={() => run("resume")}>Resume</DropdownMenuItem>}
        {["running", "paused", "scheduled"].includes(status) && (
          <DropdownMenuItem variant="destructive" onClick={() => run("stop")}>
            Stop
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
