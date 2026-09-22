import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveCredential } from "@/lib/credentials";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IntegrationsAlerts } from "@/components/integrations/integrations-alerts";
import { TwilioCredentialForm } from "@/components/integrations/twilio-credential-form";
import { OpenAiCredentialForm } from "@/components/integrations/openai-credential-form";
import { GoogleCalendarCard } from "@/components/integrations/google-calendar-card";
import { WebhookManager } from "@/components/integrations/webhook-manager";

export const metadata: Metadata = { title: "Integrations" };

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <Badge variant={connected ? "success" : "secondary"}>
      {connected ? "Connected" : "Not connected"}
    </Badge>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspace, role } = await requireCurrentWorkspace();
  const supabase = await createClient();
  const params = await searchParams;
  const isAdmin = role === "owner" || role === "admin";

  const [
    { data: googleConnection },
    { data: twilioOverrideRows },
    { data: openaiOverrideRows },
    { data: webhooks },
    twilioAccountSid,
    twilioAuthToken,
    openaiApiKey,
  ] = await Promise.all([
    supabase
      .from("calendar_connections")
      .select("id, email, calendar_id, status, expires_at, updated_at")
      .eq("workspace_id", workspace.id)
      .eq("provider", "google")
      .maybeSingle(),
    supabase
      .from("integration_credentials")
      .select("key_name, last4")
      .eq("scope", "workspace")
      .eq("workspace_id", workspace.id)
      .eq("provider", "twilio"),
    supabase
      .from("integration_credentials")
      .select("key_name, last4")
      .eq("scope", "workspace")
      .eq("workspace_id", workspace.id)
      .eq("provider", "openai"),
    supabase
      .from("webhooks")
      .select("id, url, events, status, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    resolveCredential(workspace.id, "twilio", "account_sid"),
    resolveCredential(workspace.id, "twilio", "auth_token"),
    resolveCredential(workspace.id, "openai", "api_key"),
  ]);

  const twilioConnected = Boolean(twilioAccountSid && twilioAuthToken);
  const openaiConnected = Boolean(openaiApiKey);

  const twilioOverride = {
    accountSidLast4: twilioOverrideRows?.find((r) => r.key_name === "account_sid")?.last4 ?? null,
    authTokenLast4: twilioOverrideRows?.find((r) => r.key_name === "auth_token")?.last4 ?? null,
  };
  const openaiOverride = {
    apiKeyLast4: openaiOverrideRows?.find((r) => r.key_name === "api_key")?.last4 ?? null,
  };

  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrations"
        description="Connect the services your workspace uses for calling, AI, scheduling and notifications."
      />

      <IntegrationsAlerts connected={params.connected} error={params.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Twilio</CardTitle>
              <ConnectionBadge connected={twilioConnected} />
            </div>
            <CardDescription>
              Voice calling, phone numbers and Media Streams. Leave blank to use the platform
              default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TwilioCredentialForm
              isAdmin={isAdmin}
              accountSidLast4={twilioOverride.accountSidLast4}
              authTokenLast4={twilioOverride.authTokenLast4}
              hasOverride={Boolean(twilioOverride.accountSidLast4 || twilioOverride.authTokenLast4)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>OpenAI</CardTitle>
              <ConnectionBadge connected={openaiConnected} />
            </div>
            <CardDescription>
              Realtime voice conversations, post-call analysis and knowledge base embeddings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OpenAiCredentialForm
              isAdmin={isAdmin}
              apiKeyLast4={openaiOverride.apiKeyLast4}
              hasOverride={Boolean(openaiOverride.apiKeyLast4)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Google Calendar</CardTitle>
              <ConnectionBadge connected={googleConnection?.status === "connected"} />
            </div>
            <CardDescription>
              Lets agents check real availability and book appointments during live calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!googleConfigured && (
              <Alert>
                <AlertTitle>Google Calendar isn&apos;t configured yet</AlertTitle>
                <AlertDescription>
                  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI aren&apos;t set for
                  this deployment. The Connect button below still starts the real OAuth flow — it
                  will fail at Google until those are set.
                </AlertDescription>
              </Alert>
            )}
            <GoogleCalendarCard
              email={googleConnection?.email ?? null}
              status={googleConnection?.status ?? "disconnected"}
              calendarId={googleConnection?.calendar_id ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>SMTP / Email</CardTitle>
              <Badge variant="secondary">Not connected</Badge>
            </div>
            <CardDescription>Outbound email notifications and reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Coming in a later phase — no SMTP sending exists anywhere in the platform yet.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Register a URL to receive events for this workspace. Registration only — actually
            dispatching webhook deliveries ships in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookManager webhooks={webhooks ?? []} canDelete={isAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}
