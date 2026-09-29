import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CallsFilters } from "@/components/calls/calls-filters";

export const metadata: Metadata = { title: "Calls" };

function statusVariant(status: string): "success" | "secondary" | "destructive" | "warning" {
  if (status === "completed") return "success";
  if (["failed", "canceled"].includes(status)) return "destructive";
  if (["ringing", "initiated", "queued", "in_progress"].includes(status)) return "warning";
  return "secondary";
}

const OUTCOME_LABELS: Record<string, string> = {
  qualified: "Qualified",
  appointment_booked: "Appointment booked",
  not_interested: "Not interested",
  follow_up_needed: "Follow up needed",
  no_decision: "No decision",
  wrong_number: "Wrong number",
  voicemail: "Voicemail",
  incomplete: "Incomplete",
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const params = await searchParams;

  const [{ data: agents }, { data: campaigns }] = await Promise.all([
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("campaigns").select("id, name").eq("workspace_id", workspace.id).order("name"),
  ]);

  let query = supabase
    .from("calls")
    .select(
      "id, status, outcome, duration_seconds, direction, created_at, appointment_id, contact:contacts(first_name,last_name,company,phone), campaign:campaigns(id,name), agent:agents(id,name), phone_number:phone_numbers(phone_number)"
    )
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.agentId) query = query.eq("agent_id", params.agentId);
  if (params.campaignId) query = query.eq("campaign_id", params.campaignId);
  if (params.outcome) query = query.eq("outcome", params.outcome);
  if (params.hasAppointment === "true") query = query.not("appointment_id", "is", null);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);

  const { data: calls } = await query;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Calls" description="Every call your agents have placed, with recordings and transcripts." />

      <Card className="p-4">
        <CallsFilters agents={agents ?? []} campaigns={campaigns ?? []} />
      </Card>

      {!calls || calls.length === 0 ? (
        <EmptyState
          title="No calls yet"
          description="Calls placed by campaigns or test calls will show up here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Campaign / Agent</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Appointment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => {
                const contact = call.contact as unknown as { first_name: string | null; last_name: string | null; company: string | null; phone: string } | null;
                const campaign = call.campaign as unknown as { id: string; name: string } | null;
                const agent = call.agent as unknown as { id: string; name: string } | null;
                const outcomeLabel = call.outcome ? (OUTCOME_LABELS[call.outcome] ?? call.outcome) : null;
                return (
                  <TableRow key={call.id}>
                    <TableCell>
                      <Link href={`/calls/${call.id}`} className="whitespace-nowrap hover:underline">
                        {new Date(call.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {new Date(call.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48">
                      <p className="truncate font-medium">
                        {[contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || contact?.phone || "Unknown"}
                      </p>
                      {contact?.company && <p className="truncate text-xs text-muted-foreground">{contact.company}</p>}
                    </TableCell>
                    <TableCell className="max-w-40">
                      <p className="truncate">{campaign?.name ?? "—"}</p>
                      {agent?.name && <p className="truncate text-xs text-muted-foreground">{agent.name}</p>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDuration(call.duration_seconds)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(call.status)} className="whitespace-nowrap">
                        {call.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48">
                      {outcomeLabel ? (
                        <span className="block truncate" title={outcomeLabel}>
                          {outcomeLabel}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {call.appointment_id ? (
                        <Badge variant="success" className="whitespace-nowrap">
                          Booked
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
