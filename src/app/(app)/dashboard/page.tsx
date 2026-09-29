import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCall, Users, CalendarClock, Megaphone, Plus, Bot, Trophy } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CallsOverTimeChart, type DailyPoint } from "@/components/analytics/calls-over-time-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { RecentCallsTimeline, type RecentCallItem } from "@/components/dashboard/recent-calls-timeline";

export const metadata: Metadata = { title: "Dashboard" };

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function DashboardPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const [
    { count: totalCalls },
    { count: appointmentsBooked },
    { count: qualifiedLeads },
    { count: activeCampaigns },
    { data: recentCalls },
    { data: upcomingAppointments },
    { data: campaignStatusRows },
    { data: recentCallsForAgents },
  ] = await Promise.all([
    supabase.from("calls").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "qualified"),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "running"),
    supabase
      .from("calls")
      .select("id, status, outcome, duration_seconds, created_at, contact:contacts(first_name,last_name,company), agent:agents(name), campaign:campaigns(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("appointments")
      .select("id, title, starts_at, contact:contacts(first_name,last_name)")
      .eq("workspace_id", workspace.id)
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase.from("campaigns").select("status").eq("workspace_id", workspace.id),
    supabase
      .from("calls")
      .select("agent_id, status, agent:agents(name)")
      .eq("workspace_id", workspace.id)
      .gte("created_at", daysAgo(30))
      .not("agent_id", "is", null)
      .limit(500),
  ]);

  const { data: recentCallsForChart } = await supabase
    .from("calls")
    .select("created_at, appointment_id")
    .eq("workspace_id", workspace.id)
    .gte("created_at", daysAgo(14));

  const dailyMap = new Map<string, DailyPoint>();
  for (const call of recentCallsForChart ?? []) {
    const key = dayKey(new Date(call.created_at));
    const point = dailyMap.get(key) ?? { date: key, calls: 0, appointments: 0 };
    point.calls += 1;
    if (call.appointment_id) point.appointments += 1;
    dailyMap.set(key, point);
  }
  const dailySeries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const totalCampaigns = campaignStatusRows?.length ?? 0;
  const runningCampaigns = (campaignStatusRows ?? []).filter((c) => c.status === "running").length;
  const campaignRunningPercent = totalCampaigns > 0 ? (runningCampaigns / totalCampaigns) * 100 : 0;

  const agentStats = new Map<string, { name: string; total: number; connected: number }>();
  for (const call of recentCallsForAgents ?? []) {
    if (!call.agent_id) continue;
    const agent = call.agent as unknown as { name: string } | null;
    const entry = agentStats.get(call.agent_id) ?? { name: agent?.name ?? "Unknown agent", total: 0, connected: 0 };
    entry.total += 1;
    if (call.status === "completed") entry.connected += 1;
    agentStats.set(call.agent_id, entry);
  }
  const topAgents = Array.from(agentStats.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const recentCallItems: RecentCallItem[] = (recentCalls ?? []).map((call) => {
    const contact = call.contact as unknown as { first_name: string | null; last_name: string | null; company: string | null } | null;
    const agent = call.agent as unknown as { name: string } | null;
    return {
      id: call.id,
      status: call.status,
      outcome: call.outcome,
      durationSeconds: call.duration_seconds,
      createdAt: call.created_at,
      contactName: [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "Unknown contact",
      agentName: agent?.name ?? null,
    };
  });

  const stats = [
    { label: "Active Campaigns", value: activeCampaigns ?? 0, icon: Megaphone, accent: true },
    { label: "Calls Made", value: totalCalls ?? 0, icon: PhoneCall },
    { label: "Qualified Leads", value: qualifiedLeads ?? 0, icon: Users },
    { label: "Appointments Booked", value: appointmentsBooked ?? 0, icon: CalendarClock },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track your campaigns, calls, and booked meetings at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/agents/new">
              <Bot /> Create Agent
            </Link>
          </Button>
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus /> Launch Campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} accent={stat.accent} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Call &amp; Booking Trends</CardTitle>
            <CardDescription>
              <Link href="/analytics" className="hover:underline">
                Last 14 days · See full analytics →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailySeries.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No calls in the last 14 days.</p>
            ) : (
              <CallsOverTimeChart data={dailySeries} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
            <CardDescription>Next confirmed meetings</CardDescription>
          </CardHeader>
          <CardContent>
            {!upcomingAppointments || upcomingAppointments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing booked yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcomingAppointments.map((appt) => {
                  const contact = appt.contact as unknown as { first_name: string | null; last_name: string | null } | null;
                  return (
                    <li key={appt.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CalendarClock className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {[contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || appt.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {new Date(appt.starts_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Calls</CardTitle>
            <CardDescription>Latest activity across all campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCallItems.length === 0 ? (
              <EmptyState
                title="No calls yet"
                description="Once a campaign starts dialing, calls will show up here in real time."
                actionHref="/campaigns/new"
                actionLabel="Create a campaign"
              />
            ) : (
              <RecentCallsTimeline calls={recentCallItems} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Status</CardTitle>
            <CardDescription>Share of campaigns currently running</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <ProgressRing percent={campaignRunningPercent} label="Running" />
            <p className="text-xs text-muted-foreground">
              {runningCampaigns} of {totalCampaigns} campaign{totalCampaigns === 1 ? "" : "s"} running
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-primary text-primary-foreground shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Agent Performance
            </CardTitle>
            <CardDescription className="text-primary-foreground/70">Top agents, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {topAgents.length === 0 ? (
              <p className="py-6 text-center text-sm text-primary-foreground/70">No calls handled yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {topAgents.map((agent, index) => {
                  const rate = agent.total > 0 ? Math.round((agent.connected / agent.total) * 100) : 0;
                  return (
                    <li key={agent.name + index} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium">{agent.name}</span>
                      </div>
                      <div className="shrink-0 text-right text-xs text-primary-foreground/80">
                        <span className="font-semibold">{agent.total}</span> calls · {rate}% connected
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
