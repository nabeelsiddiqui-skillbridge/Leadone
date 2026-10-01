"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import type { CampaignStatus } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
  startCampaignAction,
  stopCampaignAction,
} from "@/app/(app)/campaigns/actions";

export function CampaignDetailActions({
  campaignId,
  campaignName,
  status,
  size = "default",
  /** One clear primary button + a "⋯" menu for anything else, instead of a row of buttons. Use on list/summary views. */
  compact = false,
  redirectAfterDeleteHref,
}: {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  size?: "default" | "sm";
  compact?: boolean;
  /** Where to navigate after a successful delete. Omit to just refresh the current view (e.g. a list row). */
  redirectAfterDeleteHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  function run(promise: Promise<{ error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await promise;
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
        router.refresh();
      }
    });
  }

  function handleDeleteConfirmed() {
    setConfirmDelete(false);
    startTransition(async () => {
      const result = await deleteCampaignAction(campaignId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${campaignName} deleted.`);
      if (redirectAfterDeleteHref) {
        router.push(redirectAfterDeleteHref);
      } else {
        router.refresh();
      }
    });
  }

  const confirmDialogs = (
    <>
      <Dialog open={confirmStop} onOpenChange={setConfirmStop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop this campaign?</DialogTitle>
            <DialogDescription>
              &quot;{campaignName}&quot; will stop calling and move to Stopped. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStop(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmStop(false);
                run(stopCampaignAction(campaignId), "Campaign stopped.");
              }}
            >
              Stop campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this calling list?</DialogTitle>
            <DialogDescription>
              &quot;{campaignName}&quot; and its lead list will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (compact) {
    // One clear thing to do next, plus a "⋯" menu for the rest — avoids a
    // wall of buttons on list views where several agents show at once.
    let primary: { label: string; onClick: () => void; variant?: "default" | "destructive" } | null = null;
    const secondary: { label: string; onClick: () => void; destructive?: boolean }[] = [];

    if (status === "draft") {
      primary = { label: "Start calling", onClick: () => run(startCampaignAction(campaignId), "Calling list started.") };
      secondary.push({ label: "Delete", onClick: () => setConfirmDelete(true), destructive: true });
    } else if (status === "running") {
      primary = { label: "Pause", onClick: () => run(pauseCampaignAction(campaignId), "Campaign paused.") };
      secondary.push({ label: "Stop", onClick: () => setConfirmStop(true), destructive: true });
    } else if (status === "paused") {
      primary = { label: "Resume", onClick: () => run(resumeCampaignAction(campaignId), "Campaign resumed.") };
      secondary.push({ label: "Stop", onClick: () => setConfirmStop(true), destructive: true });
    } else if (status === "scheduled") {
      primary = { label: "Stop", onClick: () => setConfirmStop(true), variant: "destructive" };
    }

    if (!primary && secondary.length === 0) {
      return confirmDialogs;
    }

    return (
      <>
        <div className="flex items-center gap-1">
          {primary && (
            <Button size={size} variant={primary.variant} disabled={isPending} onClick={primary.onClick}>
              {primary.label}
            </Button>
          )}
          {secondary.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8" disabled={isPending}>
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondary.map((item) => (
                  <DropdownMenuItem key={item.label} variant={item.destructive ? "destructive" : "default"} onSelect={item.onClick}>
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {confirmDialogs}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <>
            <Button
              size={size}
              disabled={isPending}
              onClick={() => run(startCampaignAction(campaignId), "Calling list started.")}
            >
              Start calling
            </Button>
            <Button size={size} variant="outline" disabled={isPending} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </>
        )}
        {status === "running" && (
          <Button
            size={size}
            variant="outline"
            disabled={isPending}
            onClick={() => run(pauseCampaignAction(campaignId), "Campaign paused.")}
          >
            Pause
          </Button>
        )}
        {status === "paused" && (
          <Button
            size={size}
            variant="outline"
            disabled={isPending}
            onClick={() => run(resumeCampaignAction(campaignId), "Campaign resumed.")}
          >
            Resume
          </Button>
        )}
        {["running", "paused", "scheduled"].includes(status) && (
          <Button size={size} variant="destructive" disabled={isPending} onClick={() => setConfirmStop(true)}>
            Stop
          </Button>
        )}
      </div>
      {confirmDialogs}
    </>
  );
}
