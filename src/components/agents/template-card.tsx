"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivateTemplateDialog } from "@/components/agents/activate-template-dialog";
import { getAgentTemplate } from "@/lib/agent-templates";

export function TemplateCard({ templateSlug }: { templateSlug: string }) {
  const [open, setOpen] = useState(false);
  const template = getAgentTemplate(templateSlug);
  if (!template) return null;
  const Icon = template.icon;

  return (
    <>
      <Card className="group flex flex-col gap-4 overflow-hidden p-5 transition-shadow hover:shadow-lg">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundImage: `linear-gradient(135deg, ${template.accentColor}, ${template.accentColor}cc)` }}
          >
            <Icon className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold text-foreground">{template.name}</h3>
            <p className="text-xs text-muted-foreground">{template.roleLabel}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{template.tagline}</p>

        <ul className="flex flex-col gap-1.5">
          {template.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0" style={{ color: template.accentColor }} />
              {feature}
            </li>
          ))}
        </ul>

        <Button onClick={() => setOpen(true)} className="mt-auto" style={{ backgroundColor: template.accentColor }}>
          Use this agent
        </Button>
      </Card>

      <ActivateTemplateDialog templateSlug={templateSlug} open={open} onOpenChange={setOpen} />
    </>
  );
}
