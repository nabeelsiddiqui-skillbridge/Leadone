import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AddPhoneNumberDialog } from "@/components/phone-numbers/add-phone-number-dialog";
import { PhoneNumberRowActions } from "@/components/phone-numbers/phone-number-row-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Phone Numbers" };

export default async function PhoneNumbersPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: numbers } = await supabase
    .from("phone_numbers")
    .select("*, campaigns:campaigns(count)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Phone Numbers"
        description="Numbers your agents call out from. Twilio sync and number purchasing land in a later phase — add the numbers you already own for now."
        action={<AddPhoneNumberDialog />}
      />

      {!numbers || numbers.length === 0 ? (
        <EmptyState
          title="No phone numbers yet"
          description="Add a Twilio number so campaigns have somewhere to call from."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Friendly Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((n) => {
                const campaignCount = Array.isArray(n.campaigns)
                  ? ((n.campaigns[0] as unknown as { count: number } | undefined)?.count ?? 0)
                  : 0;
                return (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">
                      {n.phone_number}
                      {n.is_default && (
                        <Badge variant="secondary" className="ml-2">
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{n.friendly_name ?? "—"}</TableCell>
                    <TableCell>{n.country ?? "—"}</TableCell>
                    <TableCell>{campaignCount}</TableCell>
                    <TableCell>
                      <Badge variant={n.status === "active" ? "success" : "secondary"}>{n.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <PhoneNumberRowActions id={n.id} isDefault={n.is_default} status={n.status} />
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
