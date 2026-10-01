"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

import { activateAgentTemplateAction } from "@/app/(app)/agents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAgentTemplate } from "@/lib/agent-templates";

export function ActivateTemplateDialog({
  templateSlug,
  open,
  onOpenChange,
}: {
  templateSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const template = getAgentTemplate(templateSlug);

  function handleSubmit() {
    if (!template) return;
    if (!companyName.trim()) {
      setError("Enter your company name.");
      return;
    }
    if (!businessDescription.trim()) {
      setError(`Answer: ${template.setupField.label}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await activateAgentTemplateAction({
        templateSlug: template.slug,
        companyName,
        businessDescription,
        extraContext,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      toast.success(`${template.name} is ready.`);
    });
  }

  if (!template) return null;
  const Icon = template.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundImage: `linear-gradient(135deg, ${template.accentColor}, ${template.accentColor}cc)` }}
            >
              <Icon className="size-5" />
            </span>
            <div>
              <DialogTitle>Set up your {template.name}</DialogTitle>
              <DialogDescription>Two quick questions and it&apos;s ready to start calling.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="template-company-name">Your company name</Label>
            <Input
              id="template-company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template-business-description">{template.setupField.label}</Label>
            <Textarea
              id="template-business-description"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder={template.setupField.placeholder}
              rows={3}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template-extra-context">Anything else it should know? (optional)</Label>
            <Textarea
              id="template-extra-context"
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="Specific things to mention, avoid, or always do differently..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={pending} style={{ backgroundColor: template.accentColor }}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Setting up…" : "Create my agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
