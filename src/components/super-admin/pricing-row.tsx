"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePricingAction } from "@/app/super-admin/settings/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

export function PricingRow({
  provider,
  unit,
  unitCostMicros,
}: {
  provider: string;
  unit: string;
  unitCostMicros: number;
}) {
  const [value, setValue] = useState((unitCostMicros / 1_000_000).toFixed(4));
  const [pending, startTransition] = useTransition();

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{provider}</TableCell>
      <TableCell className="font-mono text-xs">{unit}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <Input
            className="w-28"
            type="number"
            step="0.0001"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const micros = Math.round(Number(value) * 1_000_000);
                const result = await updatePricingAction(provider, unit, micros);
                if (result.error) toast.error(result.error);
                else toast.success(result.message ?? "Saved.");
              })
            }
          >
            Save
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
