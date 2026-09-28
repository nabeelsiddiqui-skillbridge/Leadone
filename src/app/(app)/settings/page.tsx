import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { WorkspaceNameForm } from "@/components/settings/workspace-name-form";
import { CallingDefaultsForm } from "@/components/settings/calling-defaults-form";
import type { CallingDefaults } from "@/app/(app)/settings/actions";
import type { Json } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Settings" };

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Ships in a later phase.</CardContent>
    </Card>
  );
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const LIMIT_ROWS: { key: string; label: string }[] = [
  { key: "agents", label: "Agents" },
  { key: "campaigns", label: "Campaigns" },
  { key: "contacts", label: "Contacts" },
  { key: "concurrent_calls", label: "Concurrent calls" },
  { key: "monthly_minutes", label: "Monthly minutes" },
];

export default async function SettingsPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const settings = (workspace.settings as Record<string, Json> | null) ?? {};
  const calling = (settings.calling as CallingDefaults) ?? {};
  const limits = (workspace.limits as Record<string, number> | null) ?? {};

  const [
    { data: catalogPlan },
    { data: activeCustomPlan },
    { data: pendingCustomPlan },
    { count: agentCount },
    { count: campaignCount },
    { count: contactCount },
    { data: usageThisMonth },
  ] = await Promise.all([
    supabase.from("plans").select("price_cents").eq("key", workspace.plan).maybeSingle(),
    supabase
      .from("custom_plans")
      .select("price_cents")
      .eq("workspace_id", workspace.id)
      .eq("status", "active")
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("custom_plans")
      .select("token, name, status")
      .eq("workspace_id", workspace.id)
      .in("status", ["draft", "requested"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("agents").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase
      .from("usage_records")
      .select("calls_count, connected_calls_count, twilio_minutes, openai_tokens, estimated_cost_cents")
      .eq("workspace_id", workspace.id)
      .gte("period_date", startOfMonth()),
  ]);

  const planPriceCents = catalogPlan?.price_cents ?? activeCustomPlan?.price_cents ?? 0;
  const usageCostCents = (usageThisMonth ?? []).reduce((sum, r) => sum + r.estimated_cost_cents, 0);
  const totalCalls = (usageThisMonth ?? []).reduce((sum, r) => sum + r.calls_count, 0);
  const connectedCalls = (usageThisMonth ?? []).reduce((sum, r) => sum + r.connected_calls_count, 0);
  const twilioMinutes = (usageThisMonth ?? []).reduce((sum, r) => sum + r.twilio_minutes, 0);
  const openaiTokens = (usageThisMonth ?? []).reduce((sum, r) => sum + r.openai_tokens, 0);

  const usageCounts: Record<string, number> = {
    agents: agentCount ?? 0,
    campaigns: campaignCount ?? 0,
    contacts: contactCount ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Workspace-wide configuration." />

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="calling">Calling</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Plan &amp; Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
              <CardDescription>Basic details about this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <WorkspaceNameForm name={workspace.name} />
              <div className="border-t pt-4">
                <p className="text-sm font-medium">Do Not Call list</p>
                <p className="text-sm text-muted-foreground">
                  Numbers that must never be called by any campaign or agent.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/settings/do-not-call">Manage Do Not Call list</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calling" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calling defaults</CardTitle>
              <CardDescription>Applied when a new campaign doesn&apos;t override them.</CardDescription>
            </CardHeader>
            <CardContent>
              <CallingDefaultsForm defaults={calling} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <PlaceholderCard
            title="Security"
            description="SSO, session policies, and audit export for this workspace."
          />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <PlaceholderCard
            title="Notifications"
            description="Email/Slack alerts for campaign completion, failed calls, and appointments."
          />
        </TabsContent>

        <TabsContent value="billing" className="mt-4 flex flex-col gap-4">
          {pendingCustomPlan && (
            <Alert>
              <Gift />
              <AlertTitle>A custom package is waiting for you</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>
                  &quot;{pendingCustomPlan.name}&quot; —{" "}
                  {pendingCustomPlan.status === "requested" ? "requested, awaiting approval." : "ready to request."}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/plans/custom/${pendingCustomPlan.token}`}>View</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current plan</CardTitle>
              <CardDescription className="capitalize">{workspace.plan}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-2xl font-semibold tabular-nums">
                ${(planPriceCents / 100).toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground"> /month</span>
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {LIMIT_ROWS.map((row) => {
                  const limit = limits[row.key];
                  const used = usageCounts[row.key];
                  return (
                    <div key={row.key} className="rounded-md border px-3 py-2 text-sm">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className="font-medium tabular-nums">
                        {used !== undefined ? `${used.toLocaleString()} / ` : ""}
                        {(limit ?? 0).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage this month</CardTitle>
              <CardDescription>From call activity, rolled up daily.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Calls</p>
                <p className="text-xl font-semibold tabular-nums">{totalCalls}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Connected</p>
                <p className="text-xl font-semibold tabular-nums">{connectedCalls}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Call Minutes</p>
                <p className="text-xl font-semibold tabular-nums">{twilioMinutes.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AI Tokens</p>
                <p className="text-xl font-semibold tabular-nums">{openaiTokens.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estimated billing this month</CardTitle>
              <CardDescription>Plan price plus estimated usage cost — not an actual invoice.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="text-lg font-semibold tabular-nums">${(planPriceCents / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Usage cost</p>
                <p className="text-lg font-semibold tabular-nums">${(usageCostCents / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimated total</p>
                <p className="text-lg font-semibold tabular-nums">
                  ${((planPriceCents + usageCostCents) / 100).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
