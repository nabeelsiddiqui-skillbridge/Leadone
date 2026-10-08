"use client";

import Link from "next/link";
import { PhoneOutgoing, Mic } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AgentOption, WizardState } from "./types";

const DIRECTION_LABEL: Record<AgentOption["call_direction"], string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  both: "Outbound + Inbound",
};

export function StepAgent({
  state,
  update,
  agents,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  agents: AgentOption[];
}) {
  if (agents.length === 0) {
    return (
      <EmptyState
        title="No active agents"
        description="Create and activate an AI agent before building a campaign around it."
        actionHref="/agents/templates"
        actionLabel="Create an agent"
      />
    );
  }

  return (
    <RadioGroup
      value={state.agentId ?? undefined}
      onValueChange={(value) => update({ agentId: value })}
      className="grid gap-3 sm:grid-cols-2"
    >
      {agents.map((agent) => (
        <Label key={agent.id} htmlFor={`agent-${agent.id}`} className="cursor-pointer font-normal">
          <Card
            className={cn(
              "gap-2 py-4 transition-colors",
              state.agentId === agent.id && "border-primary ring-1 ring-primary"
            )}
          >
            <CardContent className="flex items-start gap-3 px-4">
              <RadioGroupItem value={agent.id} id={`agent-${agent.id}`} className="mt-1" />
              <div className="min-w-0">
                <p className="font-medium">{agent.name}</p>
                <p className="text-sm text-muted-foreground">{agent.agent_role || "General purpose agent"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <PhoneOutgoing className="size-3" />
                    {DIRECTION_LABEL[agent.call_direction]}
                  </Badge>
                  <Badge variant="secondary" className="gap-1 font-normal capitalize">
                    <Mic className="size-3" />
                    {agent.voice}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Label>
      ))}
      <p className="col-span-full text-sm text-muted-foreground">
        Don&apos;t see the agent you need?{" "}
        <Link href="/agents/templates" className="text-primary hover:underline">
          Create a new agent
        </Link>
        .
      </p>
    </RadioGroup>
  );
}
