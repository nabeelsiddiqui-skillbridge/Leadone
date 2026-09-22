import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CredentialForm } from "@/components/super-admin/credential-form";
import { TestConnectionButton } from "@/components/super-admin/test-connection-button";
import { SystemToggleSetting } from "@/components/super-admin/system-toggle-setting";
import { JsonSettingsForm } from "@/components/super-admin/json-settings-form";
import { FeatureFlagToggle } from "@/components/super-admin/feature-flag-toggle";
import { PricingRow } from "@/components/super-admin/pricing-row";
import { testOpenAiConnectionAction, testTwilioConnectionAction } from "@/app/super-admin/settings/actions";
import type { Json } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Super Admin | Settings · APIs" };

function asRecord(value: Json | undefined): Record<string, unknown> {
  return (value as Record<string, unknown> | undefined) ?? {};
}

export default async function SuperAdminSettingsApisPage() {
  // Defense in depth: this page reads via the service-role client (it needs
  // to see platform-scope integration_credentials, which RLS restricts to
  // super_admin anyway, but the service-role key bypasses RLS entirely) -
  // so it re-checks authorization itself rather than relying solely on the
  // layout's requireSuperAdmin() call.
  await requireSuperAdmin();
  const db = createServiceRoleClient();

  const [{ data: credentials }, { data: settings }, { data: flags }, { data: pricing }] = await Promise.all([
    db.from("integration_credentials").select("provider, key_name, last4").eq("scope", "platform").is("workspace_id", null),
    db.from("system_settings").select("key, value"),
    db.from("feature_flags").select("*").order("key"),
    db.from("pricing_settings").select("*").order("provider"),
  ]);

  const credMap = new Map((credentials ?? []).map((c) => [`${c.provider}:${c.key_name}`, c.last4]));
  const settingsMap = new Map((settings ?? []).map((s) => [s.key, s.value]));

  const registrationEnabled = settingsMap.get("registration_enabled") === true || settingsMap.get("registration_enabled") === "true";
  const maintenanceMode = settingsMap.get("maintenance_mode") === true || settingsMap.get("maintenance_mode") === "true";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings → APIs"
        description="Platform-wide API credentials, system configuration, feature flags, and pricing."
      />

      <Tabs defaultValue="credentials">
        <TabsList>
          <TabsTrigger value="credentials">API Credentials</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">OpenAI</CardTitle>
              <CardDescription>Used for Realtime voice, post-call analysis, and knowledge base embeddings.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CredentialForm
                provider="openai"
                keyName="api_key"
                label="API Key"
                placeholder="sk-..."
                currentLast4={credMap.get("openai:api_key") ?? null}
                envFallbackConfigured={Boolean(process.env.OPENAI_API_KEY)}
              />
              <TestConnectionButton label="Validate OpenAI connection" action={testOpenAiConnectionAction} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Twilio</CardTitle>
              <CardDescription>Used for outbound calling, recordings, and Media Streams.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CredentialForm
                provider="twilio"
                keyName="account_sid"
                label="Account SID"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                currentLast4={credMap.get("twilio:account_sid") ?? null}
                envFallbackConfigured={Boolean(process.env.TWILIO_ACCOUNT_SID)}
              />
              <CredentialForm
                provider="twilio"
                keyName="auth_token"
                label="Auth Token"
                placeholder="Your Twilio auth token"
                currentLast4={credMap.get("twilio:auth_token") ?? null}
                envFallbackConfigured={Boolean(process.env.TWILIO_AUTH_TOKEN)}
              />
              <TestConnectionButton label="Validate Twilio connection" action={testTwilioConnectionAction} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google Calendar</CardTitle>
              <CardDescription>
                OAuth client credentials for appointment booking. Configured via <code className="text-xs">GOOGLE_CLIENT_ID</code>/
                <code className="text-xs">GOOGLE_CLIENT_SECRET</code> environment variables — database storage for these isn&apos;t
                needed since they identify the OAuth app itself, not a per-workspace secret.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {process.env.GOOGLE_CLIENT_ID ? "Configured via environment variables." : "Not configured."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform controls</CardTitle>
            </CardHeader>
            <CardContent>
              <SystemToggleSetting
                settingKey="registration_enabled"
                label="Registration enabled"
                description="Allow new users to sign up."
                value={registrationEnabled}
              />
              <SystemToggleSetting
                settingKey="maintenance_mode"
                label="Maintenance mode"
                description="Show a maintenance notice platform-wide (enforcement point ships alongside this flag)."
                value={maintenanceMode}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default workspace limits</CardTitle>
              <CardDescription>Applied to new workspaces on signup.</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonSettingsForm
                settingKey="default_limits"
                value={asRecord(settingsMap.get("default_limits"))}
                fields={[
                  { key: "agents", label: "Agents", type: "number" },
                  { key: "campaigns", label: "Campaigns", type: "number" },
                  { key: "contacts", label: "Contacts", type: "number" },
                  { key: "concurrent_calls", label: "Concurrent calls", type: "number" },
                  { key: "monthly_minutes", label: "Monthly minutes", type: "number" },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">OpenAI defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonSettingsForm
                settingKey="openai_defaults"
                value={asRecord(settingsMap.get("openai_defaults"))}
                fields={[
                  { key: "realtime_model", label: "Realtime model" },
                  { key: "fallback_model", label: "Fallback model" },
                  { key: "voice", label: "Default voice" },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Twilio defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonSettingsForm
                settingKey="twilio_defaults"
                value={asRecord(settingsMap.get("twilio_defaults"))}
                fields={[
                  { key: "webhook_base_url", label: "Webhook base URL" },
                  { key: "media_stream_base_url", label: "Media Stream base URL" },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature flags</CardTitle>
              <CardDescription>Global switches. Per-plan overrides can build on top of these later.</CardDescription>
            </CardHeader>
            <CardContent>
              {(flags ?? []).map((flag) => (
                <FeatureFlagToggle key={flag.key} flagKey={flag.key} description={flag.description} enabled={flag.enabled} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider pricing</CardTitle>
              <CardDescription>
                Used to estimate cost in usage_records (see /super-admin for platform-wide cost). Values are USD.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pricing ?? []).map((row) => (
                    <PricingRow key={`${row.provider}:${row.unit}`} provider={row.provider} unit={row.unit} unitCostMicros={row.unit_cost_micros} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
