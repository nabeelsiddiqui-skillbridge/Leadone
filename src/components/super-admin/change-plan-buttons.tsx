"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { assignWorkspacePlanAction } from "@/app/super-admin/users/actions";

export interface PlanOption {
  key: string;
  name: string;
  priceCents: number;
}

export function ChangePlanButtons({
  workspaceId,
  currentPlan,
  plans,
}: {
  workspaceId: string;
  currentPlan: string;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAssign(planKey: string) {
    startTransition(async () => {
      const result = await assignWorkspacePlanAction(workspaceId, planKey);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Plan updated.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {plans.map((plan) => {
        const isCurrent = plan.key === currentPlan;
        return (
          <Button
            key={plan.key}
            type="button"
            size="sm"
            variant={isCurrent ? "default" : "outline"}
            disabled={isPending || isCurrent}
            onClick={() => handleAssign(plan.key)}
          >
            {isCurrent && <Check />}
            {plan.name} — ${(plan.priceCents / 100).toFixed(0)}/mo
          </Button>
        );
      })}
    </div>
  );
}
