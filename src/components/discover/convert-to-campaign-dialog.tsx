"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall, Loader2 } from "lucide-react";

import { convertLeadToCampaignAction } from "@/app/(app)/discover/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConvertToCampaignDialog({
  leadId,
  agents,
  knownPhone,
}: {
  leadId: string;
  agents: { id: string; name: string }[];
  knownPhone: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState<string>(agents[0]?.id ?? "");
  const [phone, setPhone] = useState(knownPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!agentId) {
      setError("Choose an agent.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await convertLeadToCampaignAction(leadId, agentId, phone);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Added to the agent's calling list.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PhoneCall /> Add to calling list
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hand off to an agent</DialogTitle>
          <DialogDescription>
            This creates a contact from the lead&apos;s evidence and adds them to that agent&apos;s calling list.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any agents yet. Create one first, then come back here.
            </p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="convert-agent">Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger id="convert-agent" className="w-full">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="convert-phone">Phone number</Label>
            <Input
              id="convert-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              type="tel"
            />
            {!knownPhone && <p className="text-xs text-muted-foreground">No phone was found for this lead - enter one to proceed.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={pending || agents.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending ? "Adding…" : "Add to calling list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
