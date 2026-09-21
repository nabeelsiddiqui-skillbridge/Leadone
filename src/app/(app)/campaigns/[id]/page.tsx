import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { CampaignDetailActions } from "@/components/campaigns/campaign-detail-actions";

export const metadata: Metadata = { title: "Campaign" };

function contactName(contact: { first_name: string | null; last_name: string | null } | null) {
  if (!contact) return "Unknown contact";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed contact";
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, agent:agents(id, name), phone_number:phone_numbers(id, phone_number)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (!campaign) notFound();

  const agent = campaign.agent as unknown as { id: string; name: string } | null;
  const phoneNumber = campaign.phone_number as unknown as { id: string; phone_number: string } | null;

  const [{ data: leads }, { data: calls }] = await Promise.all([
    supabase
      .from("campaign_contacts")
      .select("id, status, attempts, last_attempt_at, added_at, contact:contacts(id, first_name, last_name, phone, company)")
      .eq("campaign_id", id)
      .eq("workspace_id", workspace.id)
      .order("added_at", { ascending: false })
      .limit(200),
    supabase
      .from("calls")
      .select("id, status, outcome, duration_seconds, created_at, contact:contacts(first_name, last_name)")
      .eq("campaign_id", id)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const totalLeads = leads?.length ?? 0;
  const callsMade = calls?.length ?? 0;
  const connected = calls?.filter((c) => c.status === "completed").length ?? 0;

  const { count: appointmentsCount } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .eq("workspace_id", workspace.id);

  const conversionRate = callsMade > 0 ? `${(((appointmentsCount ?? 0) / callsMade) * 100).toFixed(1)}%` : "—";

  const stats = [
    { label: "Total Leads", value: totalLeads },
    { label: "Calls Made", value: callsMade },
    { label: "Connected", value: connected },
    { label: "Appointments", value: appointmentsCount ?? 0 },
    { label: "Conversion Rate", value: conversionRate },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            Agent:{" "}
            {agent ? (
              <Link href={`/agents/${agent.id}`} className="hover:underline">
                {agent.name}
              </Link>
            ) : (
              "—"
            )}
            {" · "}Number: {phoneNumber?.phone_number ?? "Not assigned"}
          </p>
        </div>
        <CampaignDetailActions campaignId={campaign.id} campaignName={campaign.name} status={campaign.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-2">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads</CardTitle>
          <CardDescription>Every contact attached to this campaign and where they stand.</CardDescription>
        </CardHeader>
        <CardContent>
          {!leads || leads.length === 0 ? (
            <EmptyState title="No leads yet" description="Add leads to this campaign to start dialing." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead>Last Attempt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => {
                    const contact = lead.contact as unknown as {
                      id: string;
                      first_name: string | null;
                      last_name: string | null;
                      phone: string;
                      company: string | null;
                    } | null;
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{contactName(contact)}</TableCell>
                        <TableCell>{contact?.phone ?? "—"}</TableCell>
                        <TableCell>{contact?.company ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{lead.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{lead.attempts}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {lead.last_attempt_at ? new Date(lead.last_attempt_at).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calls</CardTitle>
          <CardDescription>Every call this campaign has placed.</CardDescription>
        </CardHeader>
        <CardContent>
          {!calls || calls.length === 0 ? (
            <EmptyState
              title="No calls yet"
              description="Calls will show up here once the campaign worker starts dialing."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Placed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => {
                    const contact = call.contact as unknown as {
                      first_name: string | null;
                      last_name: string | null;
                    } | null;
                    return (
                      <TableRow key={call.id}>
                        <TableCell className="font-medium">
                          <Link href={`/calls/${call.id}`} className="hover:underline">
                            {contactName(contact)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={call.status === "completed" ? "success" : "secondary"}>
                            {call.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.outcome ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {call.duration_seconds ? `${call.duration_seconds}s` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(call.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
