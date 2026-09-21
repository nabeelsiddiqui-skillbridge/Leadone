"use client";

import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AgentOption, WizardState } from "./types";

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
        actionHref="/agents/new"
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
                <p className="text-sm text-muted-foreground">
                  {agent.agent_role || "General purpose agent"} · voice: {agent.voice}
                </p>
              </div>
            </CardContent>
          </Card>
        </Label>
      ))}
      <p className="col-span-full text-sm text-muted-foreground">
        Don&apos;t see the agent you need?{" "}
        <Link href="/agents/new" className="text-primary hover:underline">
          Create a new agent
        </Link>
        .
      </p>
    </RadioGroup>
  );
}
