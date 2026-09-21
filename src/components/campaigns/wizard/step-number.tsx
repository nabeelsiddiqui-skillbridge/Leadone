"use client";

import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { PhoneNumberOption, WizardState } from "./types";

export function StepNumber({
  state,
  update,
  phoneNumbers,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  phoneNumbers: PhoneNumberOption[];
}) {
  if (phoneNumbers.length === 0) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          This workspace has no active phone numbers yet. You can still build the campaign and assign a
          number later — but it can&apos;t start calling until one is attached.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!state.phoneNumberId && (
        <Alert variant="warning">
          <AlertDescription>
            No number selected. You can continue, but a phone number must be assigned before this
            campaign can actually place calls.
          </AlertDescription>
        </Alert>
      )}
      <RadioGroup
        value={state.phoneNumberId ?? undefined}
        onValueChange={(value) => update({ phoneNumberId: value })}
        className="grid gap-3 sm:grid-cols-2"
      >
        {phoneNumbers.map((number) => (
          <Label
            key={number.id}
            htmlFor={`number-${number.id}`}
            className="cursor-pointer font-normal"
          >
            <Card
              className={cn(
                "gap-2 py-4 transition-colors",
                state.phoneNumberId === number.id && "border-primary ring-1 ring-primary"
              )}
            >
              <CardContent className="flex items-start gap-3 px-4">
                <RadioGroupItem value={number.id} id={`number-${number.id}`} className="mt-1" />
                <div className="min-w-0">
                  <p className="font-medium">{number.phone_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {number.friendly_name || number.country || "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Label>
        ))}
      </RadioGroup>
      {state.phoneNumberId && (
        <button
          type="button"
          className="self-start text-sm text-muted-foreground hover:text-foreground hover:underline"
          onClick={() => update({ phoneNumberId: null })}
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
