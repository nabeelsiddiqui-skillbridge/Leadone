"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updatePlanAction } from "@/app/super-admin/plans/actions";

export interface PlanRow {
  key: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_agents: number;
  max_campaigns: number;
  max_contacts: number;
  concurrent_calls: number;
  monthly_minutes: number;
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

export function PlanEditCard({ plan }: { plan: PlanRow }) {
  const [priceDollars, setPriceDollars] = useState(plan.price_cents / 100);
  const [maxAgents, setMaxAgents] = useState(plan.max_agents);
  const [maxCampaigns, setMaxCampaigns] = useState(plan.max_campaigns);
  const [maxContacts, setMaxContacts] = useState(plan.max_contacts);
  const [concurrentCalls, setConcurrentCalls] = useState(plan.concurrent_calls);
  const [monthlyMinutes, setMonthlyMinutes] = useState(plan.monthly_minutes);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updatePlanAction(plan.key, {
        name: plan.name,
        priceCents: Math.round(priceDollars * 100),
        maxAgents,
        maxCampaigns,
        maxContacts,
        concurrentCalls,
        monthlyMinutes,
      });
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Saved.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{plan.name}</CardTitle>
        {plan.description && <CardDescription>{plan.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Price / month (USD)</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              step="1"
              value={priceDollars}
              onChange={(e) => setPriceDollars(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agents" value={maxAgents} onChange={setMaxAgents} />
          <Field label="Campaigns" value={maxCampaigns} onChange={setMaxCampaigns} />
          <Field label="Contacts" value={maxContacts} onChange={setMaxContacts} />
          <Field label="Concurrent calls" value={concurrentCalls} onChange={setConcurrentCalls} />
          <Field label="Monthly minutes" value={monthlyMinutes} onChange={setMonthlyMinutes} />
        </div>
        <Button size="sm" onClick={handleSave} disabled={isPending} className="self-start">
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
