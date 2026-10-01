"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  redirectAfterDeleteHref,
}: {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  size?: "default" | "sm";
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
}
