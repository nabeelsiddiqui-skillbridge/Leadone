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
  campaigns,
  knownPhone,
}: {
  leadId: string;
  campaigns: { id: string; name: string; agent_id: string }[];
  knownPhone: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState<string>(campaigns[0]?.id ?? "");
  const [phone, setPhone] = useState(knownPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!campaignId) {
      setError("Choose a campaign.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await convertLeadToCampaignAction(leadId, campaignId, phone);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Added to campaign.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PhoneCall /> Add to campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to a calling campaign</DialogTitle>
          <DialogDescription>
            This creates a contact from the lead&apos;s evidence and adds them to the campaign&apos;s call queue, using that
            campaign&apos;s agent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any campaigns yet. Create one first, then come back here.
            </p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="convert-campaign">Campaign</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger id="convert-campaign" className="w-full">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
          <Button type="button" onClick={handleSubmit} disabled={pending || campaigns.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending ? "Adding…" : "Add to campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
