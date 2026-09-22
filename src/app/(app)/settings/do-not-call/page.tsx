import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddDncDialog } from "@/components/settings/add-dnc-dialog";
import { RemoveDncButton } from "@/components/settings/remove-dnc-button";

export const metadata: Metadata = { title: "Do Not Call" };

export default async function DoNotCallPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("do_not_call")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-3.5" /> Back to settings
        </Link>
      </div>
      <PageHeader
        title="Do Not Call"
        description="Numbers on this list are never called by any campaign or agent in this workspace."
        action={<AddDncDialog />}
      />

      {!entries || entries.length === 0 ? (
        <EmptyState
          title="No numbers on the Do Not Call list"
          description="Numbers get added here automatically when a caller asks not to be contacted again, or you can add one manually."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.phone}</TableCell>
                  <TableCell>{entry.reason ?? "—"}</TableCell>
                  <TableCell>{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <RemoveDncButton id={entry.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
