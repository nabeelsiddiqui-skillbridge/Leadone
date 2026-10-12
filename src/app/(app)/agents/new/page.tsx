import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AgentForm } from "@/components/agents/agent-form";
import { DiagnosticErrorBoundary } from "@/components/diagnostic-error-boundary";

export const metadata: Metadata = { title: "New agent" };

function serializeDiagError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack, cause: err.cause ? String(err.cause) : undefined };
  }
  return { raw: String(err) };
}

export default function NewAgentPage() {
  try {
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

        <DiagnosticErrorBoundary>
          <AgentForm mode="create" knowledgeBases={[]} />
        </DiagnosticErrorBoundary>
      </div>
    );
  } catch (err) {
    unstable_rethrow(err);
    // TEMPORARY: surface the real error instead of Next's production-scrubbed
    // generic message (React error #441) - Vercel runtime log/observability
    // access is unavailable in this session, so this is the only way to see
    // what's actually throwing. Remove once the "Create agent" crash is fixed.
    console.error("NewAgentPage threw", err);
    return (
      <pre className="whitespace-pre-wrap break-all rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
        {JSON.stringify(serializeDiagError(err), null, 2)}
      </pre>
    );
  }
}
