"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveDiscoveryProfileAction } from "@/app/(app)/discover/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const SIGNAL_OPTIONS = [
  { value: "new_location", label: "New locations opening" },
  { value: "hiring", label: "Hiring activity" },
  { value: "funding", label: "Funding announcements" },
  { value: "product_launch", label: "New product launches" },
  { value: "public_post", label: "Relevant public posts" },
  { value: "website_issue", label: "Observable website issues" },
];

export function NewProfileDialog({
  agents,
  standalone = false,
}: {
  agents: { id: string; name: string }[];
  standalone?: boolean;
}) {
  void agents; // reserved: a profile isn't tied to one agent, but kept for future per-profile default-agent suggestion
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveDiscoveryProfileAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Search created.");
      formRef.current?.reset();
      setOpen(false);
      router.push(`/discover?profile=${result.message}`);
      router.refresh();
    });
  }

  const trigger = (
    <Button size="sm" variant={standalone ? "default" : "outline"}>
      <Plus /> New search
    </Button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who should we find?</DialogTitle>
          <DialogDescription>
            Describe your target customer. Your AI agent will use this to find and score matching companies.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="profile-name">Name this search</Label>
            <Input id="profile-name" name="name" placeholder="Mid-market SaaS, US" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-description">What are you selling?</Label>
            <Textarea
              id="product-description"
              name="product_description"
              placeholder="An AI outbound calling platform for sales teams..."
              rows={2}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="icp-description">Ideal customer profile</Label>
            <Textarea
              id="icp-description"
              name="icp_description"
              placeholder="B2B SaaS companies with an outbound sales team of 5+ reps..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="target-industries">Target industries</Label>
              <Input id="target-industries" name="target_industries" placeholder="SaaS, Fintech, Healthcare" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="target-locations">Target locations</Label>
              <Input id="target-locations" name="target_locations" placeholder="United States, Canada" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="company-size-min">Min company size</Label>
              <Input id="company-size-min" name="company_size_min" type="number" min={0} placeholder="10" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-size-max">Max company size</Label>
              <Input id="company-size-max" name="company_size_max" type="number" min={0} placeholder="500" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="keywords">Keywords indicating fit</Label>
            <Input id="keywords" name="keywords" placeholder="outbound sales, call center, lead generation" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exclusions">Exclude if</Label>
            <Input id="exclusions" name="exclusions" placeholder="competitor, already a customer, agency" />
          </div>

          <div className="grid gap-2">
            <Label>Signals to watch for</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              {SIGNAL_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="signals_to_monitor" value={opt.value} className="size-4 rounded border-input" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create search"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
