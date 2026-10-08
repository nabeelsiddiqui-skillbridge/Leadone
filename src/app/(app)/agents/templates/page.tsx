import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import { AGENT_TEMPLATES } from "@/lib/agent-templates";
import { TemplateCard } from "@/components/agents/template-card";
import { CreateCustomAgentCard } from "@/components/agents/create-custom-agent-card";

export const metadata: Metadata = { title: "Pre-built AI Agents" };

export default function AgentTemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to agents
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pre-built AI Agents</h1>
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Sparkles className="size-3" /> Ready in minutes
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pick the role you need - every prompt, question, and objection response is already written. Tell it about your
          business and it&apos;s ready to start calling.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_TEMPLATES.map((template) => (
          <TemplateCard key={template.slug} templateSlug={template.slug} />
        ))}
        <CreateCustomAgentCard />
      </div>
    </div>
  );
}
