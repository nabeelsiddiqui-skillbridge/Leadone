"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteContactAction } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ContactRowActions({ contactId, contactName }: { contactId: string; contactName: string }) {
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
        <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); handleDelete(); }}>
          <Trash2 /> Delete contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
