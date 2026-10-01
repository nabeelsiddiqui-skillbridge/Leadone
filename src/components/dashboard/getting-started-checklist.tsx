import Link from "next/link";
import { Check, Sparkles, Users, PhoneCall } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  icon: typeof Sparkles;
}

/**
 * The first thing a new workspace sees: three concrete steps, in order,
 * so "where do I even start" has one obvious answer. Disappears once calls
 * are actually happening — an experienced user doesn't need this anymore.
 */
export function GettingStartedChecklist({
  hasAgent,
  hasLeads,
  hasCalls,
  agentHref,
}: {
  hasAgent: boolean;
  hasLeads: boolean;
  hasCalls: boolean;
  /** Where "Add leads" should send you once an agent exists — its own Calling section. */
  agentHref: string | null;
}) {
  if (hasCalls) return null;

  const steps: Step[] = [
    {
      title: "Create your agent",
      description: "Pick a ready-made role - Sales, Support, Appointment Setter, and more.",
      href: "/agents/templates",
      cta: "Browse agents",
      done: hasAgent,
      icon: Sparkles,
    },
    {
      title: "Add leads to call",
      description: "Pick which contacts your agent should start dialing.",
      href: hasAgent && agentHref ? agentHref : "/agents/templates",
      cta: "Add leads",
      done: hasLeads,
      icon: Users,
    },
    {
      title: "Start calling",
      description: "Launch the list and watch calls come in live.",
      href: hasAgent && agentHref ? agentHref : "/agents/templates",
      cta: "Start calling",
      done: hasCalls,
      icon: PhoneCall,
    },
  ];

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Get your first agent calling</h2>
          <p className="text-sm text-muted-foreground">Three steps - most workspaces are live in under five minutes.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-4",
                  step.done && "border-success/30 bg-success/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      step.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step.done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                </div>
                {!step.done && (
                  <Button asChild size="sm" variant="outline" className="mt-auto w-fit">
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
