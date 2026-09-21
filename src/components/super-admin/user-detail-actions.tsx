"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { setUserStatusAction, deleteUserAction } from "@/app/super-admin/users/actions";

export function UserDetailActions({
  userId,
  fullName,
  status,
  isSelf,
}: {
  userId: string;
  fullName: string | null;
  status: "active" | "suspended";
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleToggleStatus() {
    const nextStatus = status === "active" ? "suspended" : "active";
    startTransition(async () => {
      const result = await setUserStatusAction(userId, nextStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Updated.");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUserAction(userId);
      if (result.error) {
        setConfirmDelete(false);
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Deleted.");
        router.push("/super-admin/users");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleToggleStatus} disabled={isPending}>
        {status === "active" ? (
          <>
            <Ban /> Suspend
          </>
        ) : (
          <>
            <CheckCircle2 /> Activate
          </>
        )}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirmDelete(true)}
        disabled={isPending || isSelf}
        title={isSelf ? "You cannot delete your own super admin account" : undefined}
      >
        <Trash2 /> Delete account
      </Button>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {fullName || "this account"}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the user&apos;s login and profile. Data owned solely by
              this user cascades or is detached per the schema&apos;s foreign keys. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
