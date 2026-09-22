"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addWebhookAction, removeWebhookAction, toggleWebhookStatusAction } from "@/app/(app)/integrations/actions";
import { WEBHOOK_EVENT_OPTIONS } from "@/components/integrations/webhook-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: "active" | "disabled";
  created_at: string;
}

function AddWebhookDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addWebhookAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(result.message ?? "Webhook added.");
      formRef.current?.reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add webhook</DialogTitle>
          <DialogDescription>
            Register a URL and the events it should fire for. Delivery isn&apos;t wired up yet —
            this just registers the endpoint.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="webhook_url">URL</Label>
            <Input
              id="webhook_url"
              name="url"
              type="url"
              placeholder="https://example.com/webhooks/leadone"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Events</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENT_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <Checkbox name="events" value={option.value} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WebhookRow({ webhook, canDelete }: { webhook: Webhook; canDelete: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{webhook.url}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {webhook.events.map((event) => (
            <Badge key={event} variant="outline">
              {event}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={webhook.status === "active"}
            disabled={pending}
            onCheckedChange={(checked) =>
              startTransition(() => toggleWebhookStatusAction(webhook.id, checked ? "active" : "disabled"))
            }
          />
          {webhook.status === "active" ? "Active" : "Disabled"}
        </div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await removeWebhookAction(webhook.id);
                if (result?.error) toast.error(result.error);
              })
            }
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}

export function WebhookManager({ webhooks, canDelete }: { webhooks: Webhook[]; canDelete: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AddWebhookDialog />
      </div>
      {webhooks.length === 0 ? (
        <EmptyState
          title="No webhooks yet"
          description="Register a URL to receive workspace events once dispatch ships."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {webhooks.map((webhook) => (
            <WebhookRow key={webhook.id} webhook={webhook} canDelete={canDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
