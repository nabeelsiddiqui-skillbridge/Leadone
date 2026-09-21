import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CallsFilters } from "@/components/calls/calls-filters";

export const metadata: Metadata = { title: "Calls" };

function statusVariant(status: string): "success" | "secondary" | "destructive" | "warning" {
  if (status === "completed") return "success";
  if (["failed", "canceled"].includes(status)) return "destructive";
  if (["ringing", "initiated", "queued", "in_progress"].includes(status)) return "warning";
  return "secondary";
}

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

      <CallsFilters agents={agents ?? []} campaigns={campaigns ?? []} />

      {!calls || calls.length === 0 ? (
        <EmptyState
          title="No calls yet"
          description="Calls placed by campaigns or test calls will show up here."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Appointment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => {
                const contact = call.contact as unknown as { first_name: string | null; last_name: string | null; company: string | null; phone: string } | null;
                const campaign = call.campaign as unknown as { id: string; name: string } | null;
                const agent = call.agent as unknown as { id: string; name: string } | null;
                const phoneNumber = call.phone_number as unknown as { phone_number: string } | null;
                return (
                  <TableRow key={call.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/calls/${call.id}`} className="hover:underline">
                        {new Date(call.created_at).toLocaleString()}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {[contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || contact?.phone || "Unknown"}
                      {contact?.company ? ` · ${contact.company}` : ""}
                    </TableCell>
                    <TableCell>{campaign?.name ?? "—"}</TableCell>
                    <TableCell>{agent?.name ?? "—"}</TableCell>
                    <TableCell>{phoneNumber?.phone_number ?? "—"}</TableCell>
                    <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(call.status)}>{call.status}</Badge>
                    </TableCell>
                    <TableCell>{call.outcome ?? "—"}</TableCell>
                    <TableCell>
                      {call.appointment_id ? <Badge variant="success">Booked</Badge> : "—"}
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
