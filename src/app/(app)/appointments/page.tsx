import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCall } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppointmentsFilters } from "@/components/appointments/appointments-filters";
import { CallbacksFilters } from "@/components/appointments/callbacks-filters";
import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions";
import { CallbackRowActions } from "@/components/appointments/callback-row-actions";
import { AppointmentStatusBadge, CallbackStatusBadge } from "@/components/appointments/status-badges";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";

export const metadata: Metadata = { title: "Appointments" };

interface ContactSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string;
}

interface NamedRef {
  id: string;
  name: string;
}

function contactName(contact: ContactSummary | null): string {
  if (!contact) return "Unknown";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.phone;
}

function formatDateInTimeZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

function formatTimeInTimeZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleTimeString();
  }
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const params = await searchParams;

  const [{ data: contacts }, { data: agents }, { data: campaigns }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name, phone, company")
      .eq("workspace_id", workspace.id)
      .order("first_name")
      .limit(500),
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("campaigns").select("id, name").eq("workspace_id", workspace.id).order("name"),
  ]);

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      "*, contact:contacts(id,first_name,last_name,company,email,phone), agent:agents(id,name), campaign:campaigns(id,name)"
    )
    .eq("workspace_id", workspace.id)
    .order("starts_at", { ascending: false })
    .limit(200);

  if (params.status) appointmentsQuery = appointmentsQuery.eq("status", params.status);
  if (params.from) appointmentsQuery = appointmentsQuery.gte("starts_at", params.from);
  if (params.to) appointmentsQuery = appointmentsQuery.lte("starts_at", params.to);

  let callbacksQuery = supabase
    .from("callbacks")
    .select(
      "*, contact:contacts(id,first_name,last_name,company,email,phone), agent:agents(id,name), campaign:campaigns(id,name)"
    )
    .eq("workspace_id", workspace.id)
    .order("requested_for", { ascending: false })
    .limit(200);

  if (params.cbStatus) callbacksQuery = callbacksQuery.eq("status", params.cbStatus);

  const [{ data: appointments }, { data: callbacks }] = await Promise.all([
    appointmentsQuery,
    callbacksQuery,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appointments"
        description="Appointments and callbacks your agents book during calls, plus manual scheduling."
        action={
          <NewAppointmentDialog contacts={contacts ?? []} agents={agents ?? []} campaigns={campaigns ?? []} />
        }
      />

      <Tabs defaultValue={params.tab === "callbacks" ? "callbacks" : "appointments"}>
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="callbacks">Callbacks</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="flex flex-col gap-4">
          <AppointmentsFilters />

          {!appointments || appointments.length === 0 ? (
            <EmptyState
              title="No appointments yet"
              description="Appointments your agents book during calls will show up here."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>From Call</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appt) => {
                    const contact = appt.contact as unknown as ContactSummary | null;
                    const agent = appt.agent as unknown as NamedRef | null;
                    const campaign = appt.campaign as unknown as NamedRef | null;
                    return (
                      <TableRow key={appt.id}>
                        <TableCell className="font-medium">
                          {contact ? (
                            <Link href={`/contacts/${contact.id}`} className="hover:underline">
                              {contactName(contact)}
                            </Link>
                          ) : (
                            "Unknown"
                          )}
                        </TableCell>
                        <TableCell>{contact?.company ?? "—"}</TableCell>
                        <TableCell>{contact?.email ?? "—"}</TableCell>
                        <TableCell>{contact?.phone ?? "—"}</TableCell>
                        <TableCell>{formatDateInTimeZone(appt.starts_at, appt.timezone)}</TableCell>
                        <TableCell>
                          {formatTimeInTimeZone(appt.starts_at, appt.timezone)} –{" "}
                          {formatTimeInTimeZone(appt.ends_at, appt.timezone)}
                        </TableCell>
                        <TableCell>
                          {agent ? (
                            <Link href={`/agents/${agent.id}`} className="hover:underline">
                              {agent.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {campaign ? (
                            <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                              {campaign.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <AppointmentStatusBadge status={appt.status} />
                        </TableCell>
                        <TableCell>
                          {appt.created_from_call && appt.call_id ? (
                            <Link href={`/calls/${appt.call_id}`}>
                              <Badge variant="outline" className="gap-1">
                                <PhoneCall className="size-3" /> Call
                              </Badge>
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <AppointmentRowActions id={appt.id} status={appt.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="callbacks" className="flex flex-col gap-4">
          <CallbacksFilters />

          {!callbacks || callbacks.length === 0 ? (
            <EmptyState
              title="No callbacks yet"
              description="When a caller asks to be called back later, it will show up here."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Requested For</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callbacks.map((cb) => {
                    const contact = cb.contact as unknown as ContactSummary | null;
                    const agent = cb.agent as unknown as NamedRef | null;
                    const campaign = cb.campaign as unknown as NamedRef | null;
                    return (
                      <TableRow key={cb.id}>
                        <TableCell className="font-medium">
                          {contact ? (
                            <Link href={`/contacts/${contact.id}`} className="hover:underline">
                              {contactName(contact)}
                            </Link>
                          ) : (
                            "Unknown"
                          )}
                        </TableCell>
                        <TableCell>
                          {campaign ? (
                            <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                              {campaign.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {agent ? (
                            <Link href={`/agents/${agent.id}`} className="hover:underline">
                              {agent.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDateInTimeZone(cb.requested_for, cb.timezone)} at{" "}
                          {formatTimeInTimeZone(cb.requested_for, cb.timezone)}
                        </TableCell>
                        <TableCell>
                          <CallbackStatusBadge status={cb.status} />
                        </TableCell>
                        <TableCell>
                          <CallbackRowActions id={cb.id} status={cb.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
