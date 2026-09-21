"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const WIZARD_STEPS = [
  "Details",
  "Agent",
  "Calling Number",
  "Leads",
  "Schedule",
  "Retry Rules",
  "Review",
];

export function WizardStepper({ step }: { step: number }) {
  const progress = ((step + 1) / WIZARD_STEPS.length) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Step {step + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step]}
        </span>
        <span className="text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} />
      <div className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:flex">
        {WIZARD_STEPS.map((label, index) => (
          <span
            key={label}
            className={cn(
              index === step && "text-foreground font-medium",
              index < step && "text-foreground"
            )}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>
    </div>
  );
}
