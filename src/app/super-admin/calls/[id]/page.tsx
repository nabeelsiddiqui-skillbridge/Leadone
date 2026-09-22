import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TranscriptViewer } from "@/components/calls/transcript-viewer";

export const metadata: Metadata = { title: "Super Admin | Call detail" };

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function AdminCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: call } = await supabase
    .from("calls")
    .select(
      "*, workspace:workspaces(id,name), contact:contacts(id,first_name,last_name,phone,email), campaign:campaigns(id,name), agent:agents(id,name), phone_number:phone_numbers(phone_number)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!call) notFound();

  const [{ data: transcript }, { data: toolCalls }, { data: events }, { data: turns }] = await Promise.all([
    supabase.from("call_transcripts").select("*").eq("call_id", id).order("turn_number", { ascending: true }),
    supabase.from("call_tool_calls").select("*").eq("call_id", id).order("created_at", { ascending: true }),
    supabase.from("call_events").select("*").eq("call_id", id).order("created_at", { ascending: true }),
    supabase.from("call_turns").select("*").eq("call_id", id).order("turn_number", { ascending: true }),
  ]);

  const workspace = call.workspace as unknown as { id: string; name: string } | null;
  const contact = call.contact as unknown as { id: string; first_name: string | null; last_name: string | null; phone: string } | null;
  const campaign = call.campaign as unknown as { id: string; name: string } | null;
  const agent = call.agent as unknown as { id: string; name: string } | null;
  const phoneNumber = call.phone_number as unknown as { phone_number: string } | null;

  const errorEvents = (events ?? []).filter((e) => e.event_type.includes("error"));
  const twilioEvents = (events ?? []).filter((e) => e.event_type === "twilio_status_callback");
  const usageEvents = (events ?? []).filter((e) => e.event_type === "openai_usage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/super-admin/calls" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-3.5" /> Back to calls
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {[contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || contact?.phone || "Call"}
          </h1>
          <Badge variant={call.status === "completed" ? "success" : "secondary"}>{call.status}</Badge>
          {call.outcome && <Badge variant="outline">{call.outcome}</Badge>}
          {errorEvents.length > 0 && <Badge variant="destructive">{errorEvents.length} error(s)</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {workspace?.name} · {new Date(call.created_at).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Info</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow label="Workspace" value={workspace?.name ?? "—"} />
              <InfoRow label="Campaign" value={campaign?.name ?? "—"} />
              <InfoRow label="Agent" value={agent?.name ?? "—"} />
              <InfoRow label="Phone number" value={phoneNumber?.phone_number ?? "—"} />
              <InfoRow label="Twilio Call SID" value={<span className="font-mono text-xs">{call.twilio_call_sid ?? "—"}</span>} />
              <InfoRow label="OpenAI Session" value={<span className="font-mono text-xs">{call.openai_session_id ?? "—"}</span>} />
              <InfoRow label="Duration" value={call.duration_seconds ? `${call.duration_seconds}s` : "—"} />
              {call.error_message && <InfoRow label="Error" value={<span className="text-destructive">{call.error_message}</span>} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recording</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {call.recording_url ? (
                <audio controls className="w-full" src={call.recording_url} />
              ) : (
                <p className="text-sm text-muted-foreground">No recording available.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">OpenAI Usage</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {usageEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No usage events recorded.</p>
              ) : (
                <InfoRow
                  label="Total tokens"
                  value={usageEvents.reduce((sum, e) => {
                    const payload = e.payload as Record<string, unknown> | null;
                    const total = payload?.total_tokens;
                    return sum + (typeof total === "number" ? total : 0);
                  }, 0)}
                />
              )}
              <InfoRow label="Turns logged" value={turns?.length ?? 0} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcript</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <TranscriptViewer turns={transcript ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tool Calls</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!toolCalls || toolCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tool calls.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {toolCalls.map((tc) => (
                    <div key={tc.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">{tc.tool_name}</span>
                        <Badge variant={tc.status === "success" ? "success" : tc.status === "error" ? "destructive" : "secondary"}>
                          {tc.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Twilio &amp; System Events</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!events || events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events logged.</p>
              ) : (
                <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto text-xs">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-start justify-between gap-2 border-b pb-1.5 last:border-0">
                      <span className={event.event_type.includes("error") ? "font-medium text-destructive" : "font-mono"}>
                        {event.event_type}
                      </span>
                      <span className="text-muted-foreground">{new Date(event.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {twilioEvents.length} Twilio status callback(s), {errorEvents.length} error event(s).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
