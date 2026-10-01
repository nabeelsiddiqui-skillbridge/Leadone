import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { AGENT_TEMPLATES } from "@/lib/agent-templates";
import { Card } from "@/components/ui/card";

export function AgentTemplatesPromo() {
  return (
    <Card className="relative overflow-hidden border-0 bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary)_60%,#0a2e22))] p-6 text-primary-foreground shadow-md">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">
              <Sparkles className="size-3" /> Pre-built & ready to use
            </span>
            <h2 className="mt-2 text-lg font-semibold">Launch an AI agent in minutes</h2>
            <p className="mt-0.5 text-sm text-primary-foreground/80">
              Every prompt, question, and objection response is already written. Just tell it about your business.
            </p>
          </div>
          <Link
            href="/agents/templates"
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-transform hover:scale-[1.02] sm:self-auto"
          >
            Browse agents <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {AGENT_TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <Link
                key={template.slug}
                href="/agents/templates"
                className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <Icon className="size-3.5" />
                {template.roleLabel.replace("AI ", "")}
              </Link>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
