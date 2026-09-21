"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Eye, Ban, CheckCircle2, Trash2 } from "lucide-react";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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

export interface AdminUserRow {
  id: string;
  fullName: string | null;
  status: "active" | "suspended";
  platformRole: "user" | "super_admin";
  createdAt: string;
  workspaceName: string | null;
  agentCount: number;
  campaignCount: number;
  callCount: number;
}

export function UsersTable({
  users,
  currentAdminId,
}: {
  users: AdminUserRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  function handleToggleStatus(user: AdminUserRow) {
    const nextStatus = user.status === "active" ? "suspended" : "active";
    setPendingUserId(user.id);
    startTransition(async () => {
      const result = await setUserStatusAction(user.id, nextStatus);
      setPendingUserId(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Updated.");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setPendingUserId(target.id);
    startTransition(async () => {
      const result = await deleteUserAction(target.id);
      setPendingUserId(null);
      setDeleteTarget(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Deleted.");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Workspace</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Platform Role</TableHead>
            <TableHead className="text-right">Agents / Campaigns / Calls</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.fullName || "Unnamed user"}</TableCell>
              <TableCell className="text-muted-foreground">
                {user.workspaceName ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Badge variant={user.status === "active" ? "success" : "destructive"}>
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.platformRole === "super_admin" ? "warning" : "secondary"}>
                  {user.platformRole === "super_admin" ? "Super Admin" : "User"}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {user.agentCount} / {user.campaignCount} / {user.callCount}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending && pendingUserId === user.id}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/super-admin/users/${user.id}`}>
                        <Eye /> View account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                      {user.status === "active" ? (
                        <>
                          <Ban /> Suspend
                        </>
                      ) : (
                        <>
                          <CheckCircle2 /> Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={user.id === currentAdminId}
                      onClick={() => setDeleteTarget(user)}
                    >
                      <Trash2 /> Delete account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.fullName || "this account"}?</DialogTitle>
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
    </>
  );
}
