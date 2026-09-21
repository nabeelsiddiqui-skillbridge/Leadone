import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TranscriptViewer } from "@/components/calls/transcript-viewer";

export const metadata: Metadata = { title: "Call detail" };

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: call } = await supabase
    .from("calls")
    .select(
      "*, contact:contacts(id,first_name,last_name,company,phone,email), campaign:campaigns(id,name), agent:agents(id,name), phone_number:phone_numbers(phone_number)"
    )
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!call) notFound();

  const [{ data: transcript }, { data: toolCalls }, { data: turns }, { data: appointment }, { data: recording }] =
    await Promise.all([
      supabase.from("call_transcripts").select("*").eq("call_id", id).order("turn_number", { ascending: true }),
      supabase.from("call_tool_calls").select("*").eq("call_id", id).order("created_at", { ascending: true }),
      supabase.from("call_turns").select("*").eq("call_id", id).order("turn_number", { ascending: true }),
      call.appointment_id
        ? supabase.from("appointments").select("*").eq("id", call.appointment_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("call_recordings").select("*").eq("call_id", id).maybeSingle(),
    ]);

  const contact = call.contact as unknown as {
    id: string; first_name: string | null; last_name: string | null; company: string | null; phone: string; email: string | null;
  } | null;
  const campaign = call.campaign as unknown as { id: string; name: string } | null;
  const agent = call.agent as unknown as { id: string; name: string } | null;
  const phoneNumber = call.phone_number as unknown as { phone_number: string } | null;

  const latencies = (turns ?? []).map((t) => t.first_audio_latency_ms).filter((v): v is number => v !== null);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const qualification = call.qualification as Record<string, unknown> | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/calls" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-3.5" /> Back to calls
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {[contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || contact?.phone || "Call"}
          </h1>
          <Badge variant={call.status === "completed" ? "success" : "secondary"}>{call.status}</Badge>
          {call.outcome && <Badge variant="outline">{call.outcome}</Badge>}
          {call.sentiment && <Badge variant="outline">{call.sentiment} sentiment</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{new Date(call.created_at).toLocaleString()}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow label="Campaign" value={campaign ? <Link href={`/campaigns/${campaign.id}`} className="hover:underline">{campaign.name}</Link> : "—"} />
              <InfoRow label="Agent" value={agent ? <Link href={`/agents/${agent.id}`} className="hover:underline">{agent.name}</Link> : "—"} />
              <InfoRow label="Phone number" value={phoneNumber?.phone_number ?? "—"} />
              <InfoRow label="Direction" value={call.direction} />
              <InfoRow label="Duration" value={formatDuration(call.duration_seconds)} />
              <InfoRow label="Started" value={call.started_at ? new Date(call.started_at).toLocaleTimeString() : "—"} />
              <InfoRow label="Ended" value={call.ended_at ? new Date(call.ended_at).toLocaleTimeString() : "—"} />
              {call.error_message && <InfoRow label="Error" value={<span className="text-destructive">{call.error_message}</span>} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {contact ? (
                <>
                  <InfoRow label="Name" value={[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—"} />
                  <InfoRow label="Company" value={contact.company ?? "—"} />
                  <InfoRow label="Phone" value={contact.phone} />
                  <InfoRow label="Email" value={contact.email ?? "—"} />
                  <Link href={`/contacts/${contact.id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
                    View contact profile →
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No contact attached.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recording</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {call.recording_url || recording?.url ? (
                <audio controls className="w-full" src={call.recording_url ?? recording?.url ?? undefined} />
              ) : (
                <p className="text-sm text-muted-foreground">No recording available.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latency</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow label="Turns" value={turns?.length ?? 0} />
              <InfoRow label="Avg. first-audio latency" value={avgLatency !== null ? `${avgLatency} ms` : "—"} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {call.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Call Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm">
                <p>{call.summary}</p>
                {qualification && (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {qualification.primary_need ? (
                      <div>
                        <dt className="text-muted-foreground">Primary need</dt>
                        <dd>{String(qualification.primary_need)}</dd>
                      </div>
                    ) : null}
                    {qualification.next_action ? (
                      <div>
                        <dt className="text-muted-foreground">Next action</dt>
                        <dd>{String(qualification.next_action)}</dd>
                      </div>
                    ) : null}
                  </dl>
                )}
              </CardContent>
            </Card>
          )}

          {appointment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Appointment</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Title" value={appointment.title} />
                <InfoRow label="When" value={new Date(appointment.starts_at).toLocaleString()} />
                <InfoRow label="Status" value={<Badge variant="success">{appointment.status}</Badge>} />
              </CardContent>
            </Card>
          )}

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
              <CardTitle className="text-base">Tool Calls / AI Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!toolCalls || toolCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tool calls during this call.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {toolCalls.map((tc) => (
                    <div key={tc.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">{tc.tool_name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={tc.status === "success" ? "success" : tc.status === "error" ? "destructive" : "secondary"}>
                            {tc.status}
                          </Badge>
                          {tc.latency_ms !== null && <span className="text-muted-foreground">{tc.latency_ms}ms</span>}
                        </div>
                      </div>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                        {JSON.stringify(tc.arguments, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
