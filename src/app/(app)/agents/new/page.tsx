import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgentForm } from "@/components/agents/agent-form";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: knowledgeBases } = await supabase
    .from("knowledge_bases")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to agents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New agent</h1>
        <p className="text-sm text-muted-foreground">
          Define a reusable AI persona you can assign to campaigns.
        </p>
      </div>

      <AgentForm mode="create" knowledgeBases={knowledgeBases ?? []} />
    </div>
  );
}
