"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createCampaignAction } from "@/app/(app)/campaigns/actions";
import { WizardStepper, WIZARD_STEPS } from "./wizard-stepper";
import { StepDetails } from "./step-details";
import { StepAgent } from "./step-agent";
import { StepNumber } from "./step-number";
import { StepLeads } from "./step-leads";
import { StepSchedule } from "./step-schedule";
import { StepRetry } from "./step-retry";
import { StepReview } from "./step-review";
import { DEFAULT_WIZARD_STATE, type AgentOption, type ContactOption, type PhoneNumberOption, type WizardState } from "./types";

export function CampaignWizard({
  agents,
  phoneNumbers,
  contacts,
  contactsCapped,
}: {
  agents: AgentOption[];
  phoneNumbers: PhoneNumberOption[];
  contacts: ContactOption[];
  contactsCapped: boolean;
}) {
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<WizardState>(DEFAULT_WIZARD_STATE);
  const [submitting, setSubmitting] = React.useState<"draft" | "scheduled" | null>(null);

  function update(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function validateStep(current: number): string | null {
    if (current === 0 && !state.name.trim()) return "Give this campaign a name before continuing.";
    if (current === 1 && !state.agentId) return "Select an agent before continuing.";
    return null;
  }

  function goNext() {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(status: "draft" | "scheduled") {
    if (!state.name.trim()) {
      toast.error("Give this campaign a name before saving.");
      setStep(0);
      return;
    }
    if (!state.agentId) {
      toast.error("Select an agent before saving.");
      setStep(1);
      return;
    }

    setSubmitting(status);
    // On success, createCampaignAction calls redirect() server-side, which
    // throws a NEXT_REDIRECT signal the framework intercepts to navigate —
    // that must be allowed to propagate, so it is not caught here.
    const result = await createCampaignAction({
      name: state.name,
      description: state.description,
      agentId: state.agentId,
      phoneNumberId: state.phoneNumberId,
      existingContactIds: state.selectedContactIds,
      newLeads: state.newLeads
        .filter((lead) => lead.phone.trim())
        .map((lead) => ({
          first_name: lead.first_name || undefined,
          last_name: lead.last_name || undefined,
          company: lead.company || undefined,
          phone: lead.phone.trim(),
          email: lead.email || undefined,
        })),
      timezoneMode: state.timezoneMode,
      fixedTimezone: state.timezoneMode === "fixed" ? state.fixedTimezone : null,
      daysOfWeek: state.daysOfWeek,
      callingStartTime: state.callingStartTime,
      callingEndTime: state.callingEndTime,
      startDate: state.startDate || null,
      endDate: state.endDate || null,
      dailyCallLimit: state.dailyCallLimit,
      concurrencyLimit: state.concurrencyLimit,
      maxAttempts: state.maxAttempts,
      retryNoAnswerMinutes: state.retryNoAnswerMinutes,
      retryBusyMinutes: state.retryBusyMinutes,
      retryFailedMinutes: state.retryFailedMinutes,
      retryExcludedStatuses: state.retryExcludedStatuses,
      voicemailAction: state.voicemailAction,
      status,
    });
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper step={step} />

      <Card>
        <CardContent className="pt-2">
          {step === 0 && <StepDetails state={state} update={update} />}
          {step === 1 && <StepAgent state={state} update={update} agents={agents} />}
          {step === 2 && <StepNumber state={state} update={update} phoneNumbers={phoneNumbers} />}
          {step === 3 && (
            <StepLeads state={state} update={update} contacts={contacts} contactsCapped={contactsCapped} />
          )}
          {step === 4 && <StepSchedule state={state} update={update} />}
          {step === 5 && <StepRetry state={state} update={update} />}
          {step === 6 && (
            <StepReview
              state={state}
              agents={agents}
              phoneNumbers={phoneNumbers}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </CardContent>
      </Card>

      {step < WIZARD_STEPS.length - 1 && (
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
            Back
          </Button>
          <Button type="button" onClick={goNext}>
            Next
          </Button>
        </div>
      )}
      {step === WIZARD_STEPS.length - 1 && (
        <div className="flex justify-start">
          <Button type="button" variant="outline" onClick={goBack}>
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
