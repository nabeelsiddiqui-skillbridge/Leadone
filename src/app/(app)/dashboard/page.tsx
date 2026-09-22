import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PhoneCall, Users, CalendarClock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { CallsOverTimeChart, type DailyPoint } from "@/components/analytics/calls-over-time-chart";

export const metadata: Metadata = { title: "Dashboard" };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

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
    { count: totalLeads },
    { count: totalCalls },
    { count: callsToday },
    { count: connectedCalls },
    { count: appointmentsBooked },
    { count: qualifiedLeads },
    { count: activeCampaigns },
    { count: activeAgents },
    { data: recentCalls },
  ] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("calls").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .gte("created_at", startOfToday()),
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "completed"),
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
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "active"),
    supabase
      .from("calls")
      .select("id, status, outcome, duration_seconds, created_at, contact:contacts(first_name,last_name,company), agent:agents(name), campaign:campaigns(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(8),
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

  const conversionRate =
    totalCalls && appointmentsBooked ? ((appointmentsBooked / totalCalls) * 100).toFixed(1) : "0.0";

  const stats = [
    { label: "Total Leads", value: totalLeads ?? 0, icon: Users },
    { label: "Calls Made", value: totalCalls ?? 0, icon: PhoneCall },
    { label: "Calls Today", value: callsToday ?? 0, icon: PhoneCall },
    { label: "Connected Calls", value: connectedCalls ?? 0, icon: PhoneCall },
    { label: "Appointments Booked", value: appointmentsBooked ?? 0, icon: CalendarClock },
    { label: "Qualified Leads", value: qualifiedLeads ?? 0, icon: TrendingUp },
    { label: "Active Campaigns", value: activeCampaigns ?? 0, icon: TrendingUp },
    { label: "Active Agents", value: activeAgents ?? 0, icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of {workspace.name}&apos;s calling activity.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
              </div>
              <stat.icon className="size-8 text-muted-foreground/40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Conversion Rate</CardTitle>
            <CardDescription>Appointments booked per call made</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{conversionRate}%</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Calls &amp; Appointments (14 days)</CardTitle>
            <CardDescription>
              <Link href="/analytics" className="hover:underline">
                See full analytics →
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
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Calls</CardTitle>
            <CardDescription>Latest activity across all campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentCalls || recentCalls.length === 0 ? (
              <EmptyState
                title="No calls yet"
                description="Once a campaign starts dialing, calls will show up here in real time."
                actionHref="/campaigns/new"
                actionLabel="Create a campaign"
              />
            ) : (
              <ul className="divide-y">
                {recentCalls.map((call) => {
                  const contact = call.contact as unknown as { first_name: string | null; last_name: string | null; company: string | null } | null;
                  const agent = call.agent as unknown as { name: string } | null;
                  return (
                    <li key={call.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {[contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "Unknown contact"}
                          {contact?.company ? ` · ${contact.company}` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {agent?.name ?? "—"} · {new Date(call.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={call.status === "completed" ? "success" : "secondary"}>
                        {call.outcome ?? call.status}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/agents/new" className="text-sm text-primary hover:underline">
          + New agent
        </Link>
        <Link href="/campaigns/new" className="text-sm text-primary hover:underline">
          + New campaign
        </Link>
        <Link href="/contacts" className="text-sm text-primary hover:underline">
          + Import contacts
        </Link>
      </div>
    </div>
  );
}
