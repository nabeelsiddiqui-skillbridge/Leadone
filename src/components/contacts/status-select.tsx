"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateContactStatusAction } from "@/app/(app)/contacts/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTACT_STATUSES } from "@/components/contacts/constants";
import type { ContactStatus } from "@/lib/supabase/database.types";

export function ContactStatusSelect({
  contactId,
  status,
  className,
}: {
  contactId: string;
  status: ContactStatus;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const next = value as ContactStatus;
    if (next === status) return;
    startTransition(async () => {
      const { error } = await updateContactStatusAction(contactId, next);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Status updated.");
      router.refresh();
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className={className} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTACT_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
