"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { updateAppointmentStatusAction } from "@/app/(app)/appointments/actions";
import type { Database } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type AppointmentStatus = Database["public"]["Tables"]["appointments"]["Row"]["status"];

export function AppointmentRowActions({ id, status }: { id: string; status: AppointmentStatus }) {
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  function setStatus(next: AppointmentStatus, notes?: string) {
    startTransition(async () => {
      const result = await updateAppointmentStatusAction(id, next, notes);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Appointment updated.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== "confirmed" && status !== "completed" && status !== "cancelled" && (
            <DropdownMenuItem onClick={() => setStatus("confirmed")}>Confirm</DropdownMenuItem>
          )}
          {status !== "completed" && (
            <DropdownMenuItem onClick={() => setStatus("completed")}>Mark completed</DropdownMenuItem>
          )}
          {status !== "no_show" && status !== "completed" && status !== "cancelled" && (
            <DropdownMenuItem onClick={() => setStatus("no_show")}>Mark no-show</DropdownMenuItem>
          )}
          {status !== "cancelled" && (
            <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
              Cancel
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel appointment</DialogTitle>
            <DialogDescription>Optionally record why this appointment is being cancelled.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Contact requested a different time"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep appointment
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setStatus("cancelled", reason);
                setCancelOpen(false);
                setReason("");
              }}
            >
              Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
