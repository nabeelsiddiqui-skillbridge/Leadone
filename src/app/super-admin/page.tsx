import type { Metadata } from "next";
import {
  Users,
  UserPlus,
  Building2,
  Bot,
  Megaphone,
  Activity,
  Contact,
  PhoneCall,
  CalendarClock,
  Info,
} from "lucide-react";

import { DollarSign, Timer, Cpu, AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Super Admin | Dashboard" };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function SuperAdminDashboardPage() {
  // No workspace_id filter anywhere below: is_workspace_member() ORs in
  // is_super_admin(), so the normal RLS-scoped client already returns rows
  // from every workspace for a super_admin caller.
  await requireSuperAdmin();
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: newUsersThisMonth },
    { count: totalWorkspaces },
    { count: totalAgents },
    { count: totalCampaigns },
    { count: activeCampaigns },
    { count: totalContacts },
    { count: totalCalls },
    { count: callsToday },
    { count: totalAppointments },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday()),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfMonth()),
    supabase.from("workspaces").select("id", { count: "exact", head: true }),
    supabase.from("agents").select("id", { count: "exact", head: true }),
    supabase.from("campaigns").select("id", { count: "exact", head: true }),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("calls").select("id", { count: "exact", head: true }),
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday()),
    supabase.from("appointments").select("id", { count: "exact", head: true }),
  ]);

  const { data: usageLast30Days } = await supabase
    .from("usage_records")
    .select("calls_count, twilio_minutes, openai_tokens, estimated_cost_cents")
    .gte("period_date", startOfMonth().slice(0, 10));

  const platformMinutes = (usageLast30Days ?? []).reduce((sum, r) => sum + r.twilio_minutes, 0);
  const platformTokens = (usageLast30Days ?? []).reduce((sum, r) => sum + r.openai_tokens, 0);
  const platformCostCents = (usageLast30Days ?? []).reduce((sum, r) => sum + r.estimated_cost_cents, 0);
  const usageTracked = (usageLast30Days ?? []).length > 0;

  const { count: apiErrorCount } = await supabase
    .from("call_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "openai_error")
    .gte("created_at", startOfMonth());

  const stats = [
    { label: "Total Registered Users", value: totalUsers ?? 0, icon: Users },
    { label: "New Users Today", value: newUsersToday ?? 0, icon: UserPlus },
    { label: "New Users This Month", value: newUsersThisMonth ?? 0, icon: UserPlus },
    { label: "Total Workspaces", value: totalWorkspaces ?? 0, icon: Building2 },
    { label: "Total Agents", value: totalAgents ?? 0, icon: Bot },
    { label: "Total Campaigns", value: totalCampaigns ?? 0, icon: Megaphone },
    { label: "Active Campaigns", value: activeCampaigns ?? 0, icon: Activity },
    { label: "Total Contacts", value: totalContacts ?? 0, icon: Contact },
    { label: "Total Calls", value: totalCalls ?? 0, icon: PhoneCall },
    { label: "Calls Today", value: callsToday ?? 0, icon: PhoneCall },
    { label: "Appointments Booked", value: totalAppointments ?? 0, icon: CalendarClock },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Super Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide activity across every workspace.
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

      {usageTracked ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage &amp; Cost — This Month</CardTitle>
            <CardDescription>
              From <code className="text-xs">usage_records</code>, rolled up daily by POST /api/cron/rollup-usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <Timer className="size-8 text-muted-foreground/40" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Twilio Minutes</p>
                <p className="text-xl font-semibold tabular-nums">{platformMinutes.toFixed(0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu className="size-8 text-muted-foreground/40" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">OpenAI Tokens</p>
                <p className="text-xl font-semibold tabular-nums">{platformTokens.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="size-8 text-muted-foreground/40" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Estimated Cost</p>
                <p className="text-xl font-semibold tabular-nums">${(platformCostCents / 100).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-8 text-muted-foreground/40" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">OpenAI Errors (this month)</p>
                <p className="text-xl font-semibold tabular-nums">{apiErrorCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <Info />
          <AlertTitle>Usage &amp; cost data not rolled up yet</AlertTitle>
          <AlertDescription>
            <code className="text-xs">usage_records</code> is empty for this month. Configure an external
            scheduler (Vercel Cron, system crontab, etc.) to call{" "}
            <code className="text-xs">POST /api/cron/rollup-usage</code> — see its route file for the
            recommended schedule. Pricing used for the estimate is configurable under the{" "}
            <span className="font-medium">Pricing</span> tab of Settings → APIs.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
