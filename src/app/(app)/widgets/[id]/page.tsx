import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditWidgetForm } from "@/components/widgets/edit-widget-form";
import { EmbedSnippet } from "@/components/widgets/embed-snippet";

export const metadata: Metadata = { title: "Edit Widget" };

export default async function WidgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const [{ data: widget }, { data: agents }] = await Promise.all([
    supabase.from("chat_widgets").select("*").eq("id", id).eq("workspace_id", workspace.id).maybeSingle(),
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name"),
  ]);

  if (!widget) notFound();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
          <Link href="/widgets">
            <ArrowLeft /> All widgets
          </Link>
        </Button>
        <PageHeader title={widget.name} description="Edit this widget's look and behavior, or copy its embed code." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Settings</h2>
          <EditWidgetForm widget={widget} agents={agents ?? []} />
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Embed on your website or app</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Paste this snippet before the closing <code className="rounded bg-muted px-1 py-0.5 text-xs">&lt;/body&gt;</code>{" "}
              tag of your site. It loads a small floating bubble in the corner — no other setup needed.
            </p>
            <EmbedSnippet publicKey={widget.public_key} appUrl={appUrl} />
          </Card>

          <Card className="p-6">
            <h2 className="mb-1 text-sm font-semibold text-foreground">How handoff works</h2>
            <p className="text-sm text-muted-foreground">
              Every conversation starts with the AI answering instantly using this widget&apos;s agent and knowledge
              base. Open it from the{" "}
              <Link href="/live-chat" className="font-medium text-primary hover:underline">
                Live Chat
              </Link>{" "}
              inbox any time to take over and reply yourself — visitors never see whether it was AI or a teammate.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
