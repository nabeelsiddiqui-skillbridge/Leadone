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

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
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

      <Alert>
        <Info />
        <AlertTitle>Usage &amp; cost reporting ships in Phase 5</AlertTitle>
        <AlertDescription>
          Twilio/OpenAI usage, cost and error-rate cards depend on{" "}
          <code className="text-xs">usage_records</code>, which nothing populates yet. Rather
          than show fabricated numbers, those cards are left out until that phase lands.
        </AlertDescription>
      </Alert>
    </div>
  );
}
