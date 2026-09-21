"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import type { CampaignStatus } from "@/lib/supabase/database.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import {
  deleteCampaignAction,
  duplicateCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
  stopCampaignAction,
} from "@/app/(app)/campaigns/actions";

export interface CampaignListRow {
  id: string;
  name: string;
  status: CampaignStatus;
  agentName: string | null;
  phoneNumber: string | null;
  totalLeads: number;
  callsMade: number;
  connected: number;
  appointments: number;
  startDate: string | null;
  lastActivity: string;
}

type PendingConfirm = { type: "stop" | "delete"; campaign: CampaignListRow } | null;

export function CampaignsTable({ campaigns }: { campaigns: CampaignListRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<PendingConfirm>(null);

  function runAction(promise: Promise<{ error?: string }>, successMessage: string) {
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

  function handlePause(row: CampaignListRow) {
    runAction(pauseCampaignAction(row.id), `${row.name} paused.`);
  }

  function handleResume(row: CampaignListRow) {
    runAction(resumeCampaignAction(row.id), `${row.name} resumed.`);
  }

  function handleDuplicate(row: CampaignListRow) {
    startTransition(async () => {
      const result = await duplicateCampaignAction(row.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Duplicated as "${row.name} (Copy)" — saved as a draft.`);
        router.refresh();
      }
    });
  }

  function handleDelete(row: CampaignListRow) {
    if (row.status !== "draft") {
      toast.error(
        "Only draft campaigns can be deleted. Stop an active campaign instead — past campaigns stay in your history."
      );
      return;
    }
    setConfirm({ type: "delete", campaign: row });
  }

  function handleStop(row: CampaignListRow) {
    setConfirm({ type: "stop", campaign: row });
  }

  function confirmAction() {
    if (!confirm) return;
    const { type, campaign } = confirm;
    setConfirm(null);
    if (type === "stop") {
      runAction(stopCampaignAction(campaign.id), `${campaign.name} stopped.`);
    } else {
      runAction(deleteCampaignAction(campaign.id), `${campaign.name} deleted.`);
    }
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign Name</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Leads</TableHead>
              <TableHead className="text-right">Calls Made</TableHead>
              <TableHead className="text-right">Connected</TableHead>
              <TableHead className="text-right">Appointments</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((row) => {
              const conversionRate =
                row.callsMade > 0 ? `${((row.appointments / row.callsMade) * 100).toFixed(1)}%` : "—";
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link href={`/campaigns/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.agentName ?? "—"}</TableCell>
                  <TableCell>{row.phoneNumber ?? "—"}</TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalLeads}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.callsMade}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.connected}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.appointments}</TableCell>
                  <TableCell className="text-right tabular-nums">{conversionRate}</TableCell>
                  <TableCell>
                    {row.startDate ? new Date(row.startDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(row.lastActivity).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Row actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/campaigns/${row.id}`}>Open</Link>
                        </DropdownMenuItem>
                        {row.status === "running" && (
                          <DropdownMenuItem onSelect={() => handlePause(row)}>Pause</DropdownMenuItem>
                        )}
                        {row.status === "paused" && (
                          <DropdownMenuItem onSelect={() => handleResume(row)}>Resume</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => handleDuplicate(row)}>Duplicate</DropdownMenuItem>
                        {["running", "paused", "scheduled"].includes(row.status) && (
                          <DropdownMenuItem onSelect={() => handleStop(row)}>Stop</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(row)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.type === "stop" ? "Stop this campaign?" : "Delete this campaign?"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.type === "stop"
                ? `"${confirm?.campaign.name}" will stop calling and move to Stopped. This cannot be undone.`
                : `"${confirm?.campaign.name}" will be permanently deleted. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmAction}>
              {confirm?.type === "stop" ? "Stop campaign" : "Delete campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
