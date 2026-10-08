import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AgentsCallingTable } from "@/components/agents/agents-calling-table";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Your AI personas — each one ready to answer calls and chats on its own.
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/templates">Create agent</Link>
        </Button>
      </div>

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
    </div>
  );
}
