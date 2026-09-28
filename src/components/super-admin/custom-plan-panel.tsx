"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createCustomPlanAction,
  updateCustomPlanAction,
  cancelCustomPlanAction,
  approveCustomPlanAction,
  rejectCustomPlanAction,
  type CustomPlanPatch,
} from "@/app/super-admin/custom-plans/actions";
import type { Database } from "@/lib/supabase/database.types";

type CustomPlan = Database["public"]["Tables"]["custom_plans"]["Row"];

const STATUS_VARIANT = {
  draft: "secondary",
  requested: "warning",
  active: "success",
  rejected: "destructive",
} as const;

function CustomPlanFormDialog({
  workspaceId,
  existing,
  trigger,
}: {
  workspaceId: string;
  existing: CustomPlan | null;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [priceDollars, setPriceDollars] = useState((existing?.price_cents ?? 0) / 100);
  const [maxAgents, setMaxAgents] = useState(existing?.max_agents ?? 10);
  const [maxCampaigns, setMaxCampaigns] = useState(existing?.max_campaigns ?? 20);
  const [maxContacts, setMaxContacts] = useState(existing?.max_contacts ?? 10000);
  const [concurrentCalls, setConcurrentCalls] = useState(existing?.concurrent_calls ?? 5);
  const [monthlyMinutes, setMonthlyMinutes] = useState(existing?.monthly_minutes ?? 3000);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    setError(null);
    const patch: CustomPlanPatch = {
      name,
      description,
      priceCents: Math.round(priceDollars * 100),
      maxAgents,
      maxCampaigns,
      maxContacts,
      concurrentCalls,
      monthlyMinutes,
    };
    startTransition(async () => {
      const result = existing
        ? await updateCustomPlanAction(existing.id, patch)
        : await createCustomPlanAction(workspaceId, patch);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit custom package" : "Create custom package"}</DialogTitle>
          <DialogDescription>
            A one-off plan for this workspace. Once created you&apos;ll get a link to send them — everything here
            is editable until they request it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label>Package name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme VIP" />
          </div>
          <div className="grid gap-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-2">
            <Label>Price / month (USD)</Label>
            <Input
              type="number"
              min={0}
              value={priceDollars}
              onChange={(e) => setPriceDollars(Number(e.target.value) || 0)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Agents", value: maxAgents, onChange: setMaxAgents },
              { label: "Campaigns", value: maxCampaigns, onChange: setMaxCampaigns },
              { label: "Contacts", value: maxContacts, onChange: setMaxContacts },
              { label: "Concurrent calls", value: concurrentCalls, onChange: setConcurrentCalls },
              { label: "Monthly minutes", value: monthlyMinutes, onChange: setMonthlyMinutes },
            ].map((f) => (
              <div key={f.label} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={f.value}
                  onChange={(e) => f.onChange(Number(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending ? "Saving…" : existing ? "Save changes" : "Create & get link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomPlanPanel({
  workspaceId,
  customPlan,
  shareUrlBase,
}: {
  workspaceId: string;
  customPlan: CustomPlan | null;
  shareUrlBase: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const shareLink = customPlan ? `${shareUrlBase}/plans/custom/${customPlan.token}` : null;

  function copyLink() {
    if (!shareLink) return;
    navigator.clipboard
      .writeText(shareLink)
      .then(() => toast.success("Link copied."))
      .catch(() => toast.error("Couldn't copy — copy it manually."));
  }

  function handleApprove() {
    if (!customPlan) return;
    startTransition(async () => {
      const result = await approveCustomPlanAction(customPlan.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message ?? "Approved.");
        router.refresh();
      }
    });
  }

  function handleReject() {
    if (!customPlan) return;
    startTransition(async () => {
      const result = await rejectCustomPlanAction(customPlan.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message ?? "Rejected.");
        router.refresh();
      }
    });
  }

  function handleCancel() {
    if (!customPlan) return;
    startTransition(async () => {
      const result = await cancelCustomPlanAction(customPlan.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message ?? "Removed.");
        router.refresh();
      }
    });
  }

  const canCreateNew = !customPlan || customPlan.status === "active" || customPlan.status === "rejected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Custom package</CardTitle>
            <CardDescription>A one-off offer for this workspace, sent as a link.</CardDescription>
          </div>
          {customPlan && (
            <Badge variant={STATUS_VARIANT[customPlan.status]}>{customPlan.status}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {customPlan ? (
          <>
            <div className="text-sm">
              <p className="font-medium">
                {customPlan.name} — ${(customPlan.price_cents / 100).toFixed(0)}/mo
              </p>
              <p className="text-muted-foreground">
                {customPlan.max_agents} agents · {customPlan.max_campaigns} campaigns ·{" "}
                {customPlan.max_contacts.toLocaleString()} contacts · {customPlan.concurrent_calls} concurrent ·{" "}
                {customPlan.monthly_minutes.toLocaleString()} min/mo
              </p>
            </div>

            {shareLink && customPlan.status !== "active" && (
              <div className="flex items-center gap-2">
                <Input readOnly value={shareLink} className="font-mono text-xs" />
                <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                  <Copy /> Copy
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {customPlan.status === "draft" && (
                <>
                  <CustomPlanFormDialog
                    workspaceId={workspaceId}
                    existing={customPlan}
                    trigger={
                      <Button type="button" size="sm" variant="outline">
                        Edit
                      </Button>
                    }
                  />
                  <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={handleCancel}>
                    Remove
                  </Button>
                </>
              )}
              {customPlan.status === "requested" && (
                <>
                  <Button type="button" size="sm" disabled={isPending} onClick={handleApprove}>
                    Approve & activate
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleReject}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No custom package for this workspace yet.</p>
        )}

        {canCreateNew && (
          <CustomPlanFormDialog
            workspaceId={workspaceId}
            existing={null}
            trigger={
              <Button type="button" size="sm" className="self-start">
                <Plus /> {customPlan ? "Create new package" : "Create custom package"}
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
