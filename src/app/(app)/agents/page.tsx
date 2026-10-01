import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "@/components/agents/template-card";
import { AgentsCallingTable } from "@/components/agents/agents-calling-table";
import { AGENT_TEMPLATES } from "@/lib/agent-templates";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { count: agentCount } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Your AI personas — each one ready to answer calls and chats on its own.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/agents/new">Build from scratch</Link>
        </Button>
      </div>

      {(agentCount ?? 0) > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Your Agents</h2>
            <p className="text-sm text-muted-foreground">
              Live status and quick controls. The same view is on your{" "}
              <Link href="/dashboard" className="underline hover:text-foreground">
                Dashboard
              </Link>
              .
            </p>
          </div>
          <AgentsCallingTable />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Pre-built AI Agents</h2>
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Sparkles className="size-3" /> Ready in minutes
          </span>
        </div>
        <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick the role you need - every prompt, question, and objection response is already written. Tell it about your
          business and it&apos;s ready to start calling.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_TEMPLATES.map((template) => (
            <TemplateCard key={template.slug} templateSlug={template.slug} />
          ))}
        </div>
      </div>
    </div>
  );
}
