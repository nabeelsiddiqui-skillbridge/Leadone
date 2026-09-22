import type { Metadata } from "next";
import Link from "next/link";

import { requireCurrentWorkspace } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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

export default async function SettingsPage() {
  const { workspace } = await requireCurrentWorkspace();
  const settings = (workspace.settings as Record<string, Json> | null) ?? {};
  const calling = (settings.calling as CallingDefaults) ?? {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Workspace-wide configuration." />

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="calling">Calling</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
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

        <TabsContent value="usage" className="mt-4">
          <PlaceholderCard
            title="Usage"
            description="Call minutes, AI usage, and cost breakdown for this workspace — see the Super Admin platform-wide view for the admin equivalent."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
