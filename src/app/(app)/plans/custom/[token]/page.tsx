import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RequestCustomPlanButton } from "@/components/plans/request-custom-plan-button";

export const metadata: Metadata = { title: "Your custom package" };

const LIMIT_ROWS: { key: "max_agents" | "max_campaigns" | "max_contacts" | "concurrent_calls" | "monthly_minutes"; label: string }[] = [
  { key: "max_agents", label: "Agents" },
  { key: "max_campaigns", label: "Campaigns" },
  { key: "max_contacts", label: "Contacts" },
  { key: "concurrent_calls", label: "Concurrent calls" },
  { key: "monthly_minutes", label: "Monthly minutes" },
];

export default async function CustomPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: customPlan } = await supabase.from("custom_plans").select("*").eq("token", token).single();

  if (!customPlan) notFound();

  if (customPlan.workspace_id !== workspace.id) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Not available on this account</AlertTitle>
          <AlertDescription>
            This package link was made for a different account. Sign in with the account it was sent to.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xl">{customPlan.name}</CardTitle>
            {customPlan.status === "requested" && <Badge variant="warning">Awaiting approval</Badge>}
            {customPlan.status === "active" && <Badge variant="success">Active</Badge>}
            {customPlan.status === "rejected" && <Badge variant="destructive">Not approved</Badge>}
          </div>
          {customPlan.description && <CardDescription>{customPlan.description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-3xl font-semibold tabular-nums">
            ${(customPlan.price_cents / 100).toLocaleString()}
            <span className="text-base font-normal text-muted-foreground"> /month</span>
          </p>

          <ul className="grid grid-cols-2 gap-3 text-sm">
            {LIMIT_ROWS.map((row) => (
              <li key={row.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium tabular-nums">{customPlan[row.key].toLocaleString()}</span>
              </li>
            ))}
          </ul>

          {customPlan.status === "draft" && <RequestCustomPlanButton token={token} />}

          {customPlan.status === "requested" && (
            <Alert>
              <Clock />
              <AlertTitle>Request sent</AlertTitle>
              <AlertDescription>
                We&apos;ve asked the LeadOne team to activate this package on your account — it&apos;ll switch on
                as soon as they approve it.
              </AlertDescription>
            </Alert>
          )}

          {customPlan.status === "active" && (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>This package is active</AlertTitle>
              <AlertDescription>Your workspace is already running on these limits.</AlertDescription>
            </Alert>
          )}

          {customPlan.status === "rejected" && (
            <Alert variant="destructive">
              <XCircle />
              <AlertTitle>This offer isn&apos;t available</AlertTitle>
              <AlertDescription>Reach out to LeadOne support if you think this is a mistake.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
