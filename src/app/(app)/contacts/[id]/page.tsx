import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhoneCall, StickyNote, UserPlus } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ContactStatusBadge } from "@/components/contacts/status-badge";
import { AddNoteForm } from "@/components/contacts/add-note-form";

type CampaignRow = { id: string; name: string; status: string };
type CampaignContactRow = {
  id: string;
  status: string;
  attempts: number;
  added_at: string;
  campaign: CampaignRow | null;
};
type CallRow = {
  id: string;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  created_at: string;
};
type AppointmentRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
};
type NoteRow = {
  id: string;
  note: string;
  created_at: string;
  author_id: string | null;
  author: { full_name: string | null } | null;
};

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Contact ${id}` };
}

export default async function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: contactData, error } = await supabase
    .from("contacts")
    .select("*, owner:profiles(full_name)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load contact: ${error.message}`);
  }
  if (!contactData) {
    notFound();
  }

  const contact = contactData;
  const owner = contact.owner as unknown as { full_name: string | null } | null;

  const [{ data: campaignLinks }, { data: calls }, { data: appointments }, { data: notes }] = await Promise.all([
    supabase
      .from("campaign_contacts")
      .select("id, status, attempts, added_at, campaign:campaigns(id, name, status)")
      .eq("contact_id", id)
      .eq("workspace_id", workspace.id)
      .order("added_at", { ascending: false }),
    supabase
      .from("calls")
      .select("id, status, outcome, duration_seconds, started_at, created_at")
      .eq("contact_id", id)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, title, starts_at, ends_at, status")
      .eq("contact_id", id)
      .eq("workspace_id", workspace.id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("contact_notes")
      .select("id, note, created_at, author_id, author:profiles(full_name)")
      .eq("contact_id", id)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  const campaignRows = (campaignLinks ?? []) as unknown as CampaignContactRow[];
  const callRows = (calls ?? []) as unknown as CallRow[];
  const appointmentRows = (appointments ?? []) as unknown as AppointmentRow[];
  const noteRows = (notes ?? []) as unknown as NoteRow[];

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.phone;
  const customFieldEntries = Object.entries(
    (contact.custom_fields as unknown as Record<string, unknown>) ?? {}
  );

  type TimelineItem = { id: string; at: string; kind: "note" | "call" | "created"; content: string };
  const timeline: TimelineItem[] = [
    { id: `created-${contact.id}`, at: contact.created_at, kind: "created" as const, content: "Contact added" },
    ...noteRows.map((n) => ({ id: `note-${n.id}`, at: n.created_at, kind: "note" as const, content: n.note })),
    ...callRows.map((c) => ({
      id: `call-${c.id}`,
      at: c.created_at,
      kind: "call" as const,
      content: `Call ${c.status}${c.outcome ? ` · ${c.outcome}` : ""}`,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/contacts" className="text-sm text-muted-foreground hover:underline">
          ← Back to contacts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {contact.company ? `${contact.company} · ` : ""}
          {contact.phone}
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-6 pt-2 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Lead Score</p>
            <p className="text-2xl font-semibold tabular-nums">{contact.lead_score}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Last Disposition</p>
            <div className="mt-1">
              <ContactStatusBadge status={contact.status} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Next Scheduled Call</p>
            <p className="text-sm font-medium">{formatDateTime(contact.next_attempt_at)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <InfoRow label="Email" value={contact.email} />
            <InfoRow label="Website" value={contact.website} />
            <InfoRow label="Job title" value={contact.job_title} />
            <InfoRow label="Industry" value={contact.industry} />
            <InfoRow label="Country" value={contact.country} />
            <InfoRow label="Timezone" value={contact.timezone} />
            <InfoRow label="Owner" value={owner?.full_name} />
            <InfoRow label="Last called" value={formatDateTime(contact.last_called_at)} />
            {customFieldEntries.length > 0 && (
              <div className="mt-2 border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Custom fields</p>
                <div className="grid gap-1.5">
                  {customFieldEntries.map(([key, value]) => (
                    <InfoRow key={key} label={key} value={String(value)} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign history</CardTitle>
              <CardDescription>Campaigns this contact has been added to</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not part of any campaign yet.</p>
              ) : (
                <ul className="divide-y">
                  {campaignRows.map((cc) => (
                    <li key={cc.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{cc.campaign?.name ?? "Unknown campaign"}</p>
                        <p className="text-xs text-muted-foreground">{cc.attempts} attempt(s)</p>
                      </div>
                      <Badge variant="secondary">{cc.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call history</CardTitle>
              <CardDescription>All calls placed to this contact</CardDescription>
            </CardHeader>
            <CardContent>
              {callRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls yet.</p>
              ) : (
                <ul className="divide-y">
                  {callRows.map((call) => (
                    <li key={call.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/calls/${call.id}`} className="min-w-0 hover:underline">
                        <p className="font-medium">
                          {formatDateTime(call.started_at ?? call.created_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {call.outcome ?? "—"} · {formatDuration(call.duration_seconds)}
                        </p>
                      </Link>
                      <Badge variant="secondary">{call.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No appointments booked.</p>
              ) : (
                <ul className="divide-y">
                  {appointmentRows.map((appt) => (
                    <li key={appt.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{appt.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(appt.starts_at)}</p>
                      </div>
                      <Badge variant="secondary">{appt.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <AddNoteForm contactId={contact.id} />
              {noteRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {noteRows.map((note) => (
                    <li key={note.id} className="rounded-md border p-3 text-sm">
                      <p className="whitespace-pre-wrap">{note.note}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {note.author?.full_name ?? "Unknown"} · {formatDateTime(note.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
              <CardDescription>Notes and calls, most recent first</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <EmptyState title="No activity yet" description="Notes and calls for this contact will show up here." />
              ) : (
                <ul className="grid gap-3">
                  {timeline.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 text-muted-foreground">
                        {item.kind === "note" && <StickyNote className="size-4" />}
                        {item.kind === "call" && <PhoneCall className="size-4" />}
                        {item.kind === "created" && <UserPlus className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate">{item.content}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value || "—"}</span>
    </div>
  );
}

