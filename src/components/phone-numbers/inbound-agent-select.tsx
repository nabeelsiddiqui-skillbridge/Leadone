"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setInboundAgentAction } from "@/app/(app)/phone-numbers/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "none";

export function InboundAgentSelect({
  phoneNumberId,
  agentId,
  agents,
}: {
  phoneNumberId: string;
  agentId: string | null;
  agents: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={agentId ?? NONE}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setInboundAgentAction(phoneNumberId, value === NONE ? null : value);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue placeholder="No inbound agent" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No inbound agent</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
