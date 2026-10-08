import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AddPhoneNumberDialog } from "@/components/phone-numbers/add-phone-number-dialog";
import { PhoneNumberRowActions } from "@/components/phone-numbers/phone-number-row-actions";
import { InboundAgentSelect } from "@/components/phone-numbers/inbound-agent-select";
import { InboundWebhookUrl } from "@/components/phone-numbers/inbound-webhook-url";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Phone Numbers" };

export default async function PhoneNumbersPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const [{ data: numbers }, { data: inboundAgents }] = await Promise.all([
    supabase
      .from("phone_numbers")
      .select("*, campaigns:campaigns(count)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agents")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .in("call_direction", ["inbound", "both"])
      .order("name"),
  ]);

  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inboundWebhookUrl = `${baseUrl}/api/webhooks/twilio/voice-inbound`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Phone Numbers"
        description="Numbers your agents call out from, and numbers that answer calls coming in. Twilio sync and number purchasing land in a later phase — add the numbers you already own for now."
        action={<AddPhoneNumberDialog />}
      />

      {numbers && numbers.length > 0 && (
        <Alert>
          <AlertTitle>Answering inbound calls</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Assign an agent to a number below, then point that number&apos;s Twilio voice webhook at this URL
              (Twilio Console → Phone Numbers → your number → Voice Configuration → &quot;A call comes in&quot;):
            </p>
            <InboundWebhookUrl url={inboundWebhookUrl} />
          </AlertDescription>
        </Alert>
      )}

      {!numbers || numbers.length === 0 ? (
        <EmptyState
          title="No phone numbers yet"
          description="Add a Twilio number so campaigns have somewhere to call from, or for an agent to answer calls on."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Friendly Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead>Inbound Agent</TableHead>
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
                      <InboundAgentSelect phoneNumberId={n.id} agentId={n.agent_id} agents={inboundAgents ?? []} />
                    </TableCell>
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
