"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

import { deleteContactAction, updateContactStatusAction } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTACT_STATUSES } from "@/components/contacts/constants";
import type { ContactStatus } from "@/lib/supabase/database.types";

export function ContactRowActions({
  contactId,
  contactName,
  status,
}: {
  contactId: string;
  contactName: string;
  status?: ContactStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    if (!window.confirm(`Delete ${contactName}? This cannot be undone.`)) return;
    setOpen(false);
    startTransition(async () => {
      const { error } = await deleteContactAction(contactId);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Contact deleted.");
        router.refresh();
      }
    });
  }

  function handleStatusChange(next: ContactStatus) {
    setOpen(false);
    startTransition(async () => {
      const { error } = await updateContactStatusAction(contactId, next);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Status updated.");
        router.refresh();
      }
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/contacts/${contactId}`}>
            <Eye /> View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Tag /> Change status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {CONTACT_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.value}
                disabled={s.value === status}
                onSelect={(e) => {
                  e.preventDefault();
                  handleStatusChange(s.value);
                }}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); handleDelete(); }}>
          <Trash2 /> Delete contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
