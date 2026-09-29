"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteWidgetAction, toggleWidgetStatusAction } from "@/app/(app)/widgets/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WidgetStatus } from "@/lib/supabase/database.types";

export function WidgetRowActions({ id, name, status }: { id: string; name: string; status: WidgetStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggleStatus() {
    const next = status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const result = await toggleWidgetStatusAction(id, next);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(next === "active" ? "Widget activated." : "Widget deactivated.");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This removes its conversation history too.`)) return;
    startTransition(async () => {
      const result = await deleteWidgetAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Widget deleted.");
        router.refresh();
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push(`/widgets/${id}`)}>
          <Pencil /> Edit & embed code
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleToggleStatus();
          }}
        >
          <Power /> {status === "active" ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            handleDelete();
          }}
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
