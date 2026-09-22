import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { CallsOverTimeChart, type DailyPoint } from "@/components/analytics/calls-over-time-chart";
import { DistributionChart, type DistributionPoint } from "@/components/analytics/distribution-chart";

export const metadata: Metadata = { title: "Analytics" };

function resolveRange(params: { range?: string; from?: string; to?: string }): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  switch (params.range) {
    case "yesterday": {
      const from = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      return { from, to: startOfToday };
    }
    case "30d":
      return { from: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000), to: endOfToday };
    case "custom":
      return {
        from: params.from ? new Date(params.from) : new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: params.to ? new Date(new Date(params.to).getTime() + 24 * 60 * 60 * 1000) : endOfToday,
      };
    case "today":
      return { from: startOfToday, to: endOfToday };
    case "7d":
    default:
      return { from: new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000), to: endOfToday };
  }
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDuration(totalSeconds: number, count: number): string {
  if (count === 0) return "—";
  const avg = Math.round(totalSeconds / count);
  return `${Math.floor(avg / 60)}m ${avg % 60}s`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const params = await searchParams;
  const { from, to } = resolveRange(params);

  const [{ data: calls }, { data: contacts }, { data: agents }, { data: campaigns }] = await Promise.all([
    supabase
      .from("calls")
      .select("id, agent_id, campaign_id, status, outcome, duration_seconds, appointment_id, created_at")
      .eq("workspace_id", workspace.id)
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString()),
    supabase.from("contacts").select("status").eq("workspace_id", workspace.id),
    supabase.from("agents").select("id, name").eq("workspace_id", workspace.id),
    supabase.from("campaigns").select("id, name").eq("workspace_id", workspace.id),
  ]);

  const allCalls = calls ?? [];
  const totalCalls = allCalls.length;
  const connectedCalls = allCalls.filter((c) => c.status === "completed").length;
  const qualifiedCalls = allCalls.filter((c) => c.outcome === "qualified" || c.outcome === "appointment_booked").length;
  const appointmentsBooked = allCalls.filter((c) => c.appointment_id).length;
  const totalDuration = allCalls.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0);

  const connectionRate = totalCalls ? ((connectedCalls / totalCalls) * 100).toFixed(1) : "0.0";
  const qualificationRate = totalCalls ? ((qualifiedCalls / totalCalls) * 100).toFixed(1) : "0.0";
  const appointmentRate = totalCalls ? ((appointmentsBooked / totalCalls) * 100).toFixed(1) : "0.0";
  const callsPerAppointment = appointmentsBooked ? (totalCalls / appointmentsBooked).toFixed(1) : "—";

  const dailyMap = new Map<string, DailyPoint>();
  for (const call of allCalls) {
    const key = dayKey(new Date(call.created_at));
    const point = dailyMap.get(key) ?? { date: key, calls: 0, appointments: 0 };
    point.calls += 1;
    if (call.appointment_id) point.appointments += 1;
    dailyMap.set(key, point);
  }
  const dailySeries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const outcomeMap = new Map<string, number>();
  for (const call of allCalls) {
    const key = call.outcome ?? call.status;
    outcomeMap.set(key, (outcomeMap.get(key) ?? 0) + 1);
  }
  const outcomeDistribution: DistributionPoint[] = Array.from(outcomeMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const statusMap = new Map<string, number>();
  for (const contact of contacts ?? []) {
    statusMap.set(contact.status, (statusMap.get(contact.status) ?? 0) + 1);
  }
  const leadStatusDistribution: DistributionPoint[] = Array.from(statusMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const agentStats = new Map<string, { calls: number; appointments: number }>();
  for (const call of allCalls) {
    if (!call.agent_id) continue;
    const s = agentStats.get(call.agent_id) ?? { calls: 0, appointments: 0 };
    s.calls += 1;
    if (call.appointment_id) s.appointments += 1;
    agentStats.set(call.agent_id, s);
  }

  const campaignStats = new Map<string, { calls: number; appointments: number }>();
  for (const call of allCalls) {
    if (!call.campaign_id) continue;
    const s = campaignStats.get(call.campaign_id) ?? { calls: 0, appointments: 0 };
    s.calls += 1;
    if (call.appointment_id) s.appointments += 1;
    campaignStats.set(call.campaign_id, s);
  }

  const stats = [
    { label: "Calls", value: totalCalls },
    { label: "Connection Rate", value: `${connectionRate}%` },
    { label: "Qualification Rate", value: `${qualificationRate}%` },
    { label: "Appointments Booked", value: appointmentsBooked },
    { label: "Appointment Rate", value: `${appointmentRate}%` },
    { label: "Avg Call Duration", value: formatDuration(totalDuration, totalCalls) },
    { label: "Calls per Appointment", value: callsPerAppointment },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" description="Performance across every agent and campaign in this workspace." />
      <DateRangeFilter />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-2">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls &amp; Appointments Over Time</CardTitle>
            <CardDescription>Daily volume for the selected range</CardDescription>
          </CardHeader>
          <CardContent>
            {dailySeries.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No calls in this range yet.</p>
            ) : (
              <CallsOverTimeChart data={dailySeries} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call Outcome Distribution</CardTitle>
            <CardDescription>How calls in this range ended</CardDescription>
          </CardHeader>
          <CardContent>
            {outcomeDistribution.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No calls in this range yet.</p>
            ) : (
              <DistributionChart data={outcomeDistribution} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Status</CardTitle>
            <CardDescription>Current status of every contact in this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {leadStatusDistribution.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No contacts yet.</p>
            ) : (
              <DistributionChart data={leadStatusDistribution} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Performance</CardTitle>
            <CardDescription>Calls and appointments per agent in this range</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Appointments</TableHead>
                  <TableHead>Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(agents ?? []).map((agent) => {
                  const s = agentStats.get(agent.id);
                  if (!s) return null;
                  return (
                    <TableRow key={agent.id}>
                      <TableCell>{agent.name}</TableCell>
                      <TableCell>{s.calls}</TableCell>
                      <TableCell>{s.appointments}</TableCell>
                      <TableCell>{s.calls ? `${((s.appointments / s.calls) * 100).toFixed(1)}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Campaign Performance</CardTitle>
            <CardDescription>Calls and appointments per campaign in this range</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Appointments</TableHead>
                  <TableHead>Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaigns ?? []).map((campaign) => {
                  const s = campaignStats.get(campaign.id);
                  if (!s) return null;
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>{campaign.name}</TableCell>
                      <TableCell>{s.calls}</TableCell>
                      <TableCell>{s.appointments}</TableCell>
                      <TableCell>{s.calls ? `${((s.appointments / s.calls) * 100).toFixed(1)}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
