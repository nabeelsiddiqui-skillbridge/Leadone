import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-0",
        accent ? "bg-primary text-primary-foreground shadow-md" : "bg-card shadow-sm"
      )}
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={cn("text-sm font-medium", accent ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {label}
          </span>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              accent ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"
            )}
          >
            <Icon className="size-5" />
          </span>
        </div>
        <div>
          <p className="text-3xl font-semibold tabular-nums">{value}</p>
          {helper && (
            <p className={cn("mt-1 text-xs", accent ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {helper}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
