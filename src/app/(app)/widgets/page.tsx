import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewWidgetDialog } from "@/components/widgets/new-widget-dialog";
import { WidgetRowActions } from "@/components/widgets/widget-row-actions";
import type { WidgetStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Chat & Voice Widgets" };

const STATUS_VARIANT: Record<WidgetStatus, "success" | "secondary"> = { active: "success", inactive: "secondary" };

export default async function WidgetsPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const [{ data: widgets }, { data: agents }] = await Promise.all([
    supabase
      .from("chat_widgets")
      .select("*, agent:agents(name), conversations:chat_conversations(count)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Chat & Voice Widgets"
        description="Embed an AI-powered text chat and live voice bubble on your website or app. Hand off to a teammate any time — visitors never see the difference."
        action={<NewWidgetDialog agents={agents ?? []} />}
      />

      {!widgets || widgets.length === 0 ? (
        <EmptyState
          title="No widgets yet"
          description="Create a widget, customize its look, and copy the embed snippet onto your site."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Conversations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {widgets.map((w) => {
                const conversationCount = Array.isArray(w.conversations)
                  ? ((w.conversations[0] as unknown as { count: number } | undefined)?.count ?? 0)
                  : 0;
                const agent = w.agent as unknown as { name: string } | null;
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      <Link href={`/widgets/${w.id}`} className="flex items-center gap-2 hover:underline">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: w.primary_color }}
                        />
                        {w.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agent?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {w.chat_enabled && <Badge variant="outline">Chat</Badge>}
                        {w.voice_chat_enabled && <Badge variant="outline">Voice</Badge>}
                        {!w.chat_enabled && !w.voice_chat_enabled && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{conversationCount}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[w.status]}>{w.status === "active" ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <WidgetRowActions id={w.id} name={w.name} status={w.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
