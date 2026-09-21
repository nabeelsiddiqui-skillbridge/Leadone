"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DAY_LABELS, totalLeadCount, type AgentOption, type PhoneNumberOption, type WizardState } from "./types";

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function StepReview({
  state,
  agents,
  phoneNumbers,
  onSubmit,
  submitting,
}: {
  state: WizardState;
  agents: AgentOption[];
  phoneNumbers: PhoneNumberOption[];
  onSubmit: (status: "draft" | "scheduled") => void;
  submitting: "draft" | "scheduled" | null;
}) {
  const agent = agents.find((a) => a.id === state.agentId);
  const phoneNumber = phoneNumbers.find((p) => p.id === state.phoneNumberId);
  const days = state.daysOfWeek
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            <SummaryRow label="Name" value={state.name || "—"} />
            <SummaryRow label="Description" value={state.description || "—"} />
            <SummaryRow label="Agent" value={agent?.name ?? "None selected"} />
            <SummaryRow label="Phone number" value={phoneNumber?.phone_number ?? "None selected"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            <SummaryRow label="Existing contacts" value={state.selectedContactIds.length} />
            <SummaryRow
              label="New leads (CSV)"
              value={state.newLeads.filter((l) => l.source === "csv").length}
            />
            <SummaryRow
              label="New leads (manual)"
              value={state.newLeads.filter((l) => l.source === "manual" && l.phone.trim()).length}
            />
            <SummaryRow label="Total" value={totalLeadCount(state)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            <SummaryRow
              label="Timezone"
              value={state.timezoneMode === "fixed" ? state.fixedTimezone : "Contact local time"}
            />
            <SummaryRow label="Days" value={days || "None selected"} />
            <SummaryRow label="Window" value={`${state.callingStartTime} – ${state.callingEndTime}`} />
            <SummaryRow label="Start date" value={state.startDate || "Immediately"} />
            <SummaryRow label="End date" value={state.endDate || "No end date"} />
            <SummaryRow label="Daily limit" value={state.dailyCallLimit} />
            <SummaryRow label="Concurrency" value={state.concurrencyLimit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retry rules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            <SummaryRow label="Max attempts" value={state.maxAttempts} />
            <SummaryRow label="No answer retry" value={`${state.retryNoAnswerMinutes} min`} />
            <SummaryRow label="Busy retry" value={`${state.retryBusyMinutes} min`} />
            <SummaryRow label="Failed retry" value={`${state.retryFailedMinutes} min`} />
            <SummaryRow label="Voicemail" value={state.voicemailAction === "hang_up" ? "Hang up" : "Leave message"} />
            <SummaryRow
              label="Excluded from retry"
              value={state.retryExcludedStatuses.join(", ") || "None"}
            />
          </CardContent>
        </Card>
      </div>

      {!state.phoneNumberId && (
        <Alert variant="warning">
          <AlertDescription>
            No calling number assigned yet — this campaign can be saved, but won&apos;t be able to place
            calls until one is set.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSubmit("draft")}
            disabled={submitting !== null}
          >
            {submitting === "draft" ? "Saving…" : "Save as draft"}
          </Button>
          <Button type="button" onClick={() => onSubmit("scheduled")} disabled={submitting !== null}>
            {submitting === "scheduled" ? "Starting…" : "Start campaign"}
          </Button>
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">
          Calls begin once the campaign worker (Phase 4) is deployed — this schedules the campaign to run
          as soon as it is.
        </p>
      </div>
    </div>
  );
}
