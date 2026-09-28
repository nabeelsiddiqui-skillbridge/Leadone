"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestCustomPlanAction } from "@/app/(app)/plans/custom/actions";

export function RequestCustomPlanButton({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await requestCustomPlanAction(token);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message ?? "Requested.");
        router.refresh();
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending} size="lg" className="w-full sm:w-auto">
      {isPending ? "Requesting…" : "Get this package"}
    </Button>
  );
}
