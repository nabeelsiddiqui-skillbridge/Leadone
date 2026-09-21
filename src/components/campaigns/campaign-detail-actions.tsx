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
import { pauseCampaignAction, resumeCampaignAction, stopCampaignAction } from "@/app/(app)/campaigns/actions";

export function CampaignDetailActions({
  campaignId,
  campaignName,
  status,
}: {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [confirmStop, setConfirmStop] = React.useState(false);

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

  return (
    <>
      <div className="flex gap-2">
        {status === "running" && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run(pauseCampaignAction(campaignId), "Campaign paused.")}
          >
            Pause
          </Button>
        )}
        {status === "paused" && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run(resumeCampaignAction(campaignId), "Campaign resumed.")}
          >
            Resume
          </Button>
        )}
        {["running", "paused", "scheduled"].includes(status) && (
          <Button variant="destructive" disabled={isPending} onClick={() => setConfirmStop(true)}>
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
    </>
  );
}
