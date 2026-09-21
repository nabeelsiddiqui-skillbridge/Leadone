"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  removePhoneNumberAction,
  setDefaultPhoneNumberAction,
  togglePhoneNumberStatusAction,
} from "@/app/(app)/phone-numbers/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PhoneNumberRowActions({
  id,
  isDefault,
  status,
}: {
  id: string;
  isDefault: boolean;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isDefault && (
          <DropdownMenuItem onClick={() => startTransition(() => setDefaultPhoneNumberAction(id))}>
            Set as default
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            startTransition(() =>
              togglePhoneNumberStatusAction(id, status === "active" ? "inactive" : "active")
            )
          }
        >
          {status === "active" ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            startTransition(async () => {
              const result = await removePhoneNumberAction(id);
              if (result?.error) toast.error(result.error);
            })
          }
        >
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
