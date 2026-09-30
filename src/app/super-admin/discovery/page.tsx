import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, Loader2, Target, CircleCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { DiscoveryJobStatus, DiscoverySourceStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Super Admin | Discovery" };

const SOURCE_STATUS_VARIANT: Record<DiscoverySourceStatus, "success" | "warning" | "secondary"> = {
  connected: "success",
  needs_api_key: "warning",
  coming_soon: "secondary",
  disabled: "secondary",
};

const JOB_STATUS_VARIANT: Record<DiscoveryJobStatus, "success" | "warning" | "secondary" | "destructive"> = {
  completed: "success",
  running: "warning",
  queued: "secondary",
  failed: "destructive",
};

export default async function SuperAdminDiscoveryPage() {
  const supabase = await createClient();

  const [{ data: sources }, { data: credentials }, { data: jobs }, { data: workspaceCounts }] = await Promise.all([
    supabase.from("discovery_sources").select("*").order("category"),
    supabase.from("integration_credentials").select("provider").eq("scope", "platform").is("workspace_id", null),
    supabase
      .from("discovery_jobs")
      .select("id, status, source_key, trigger, companies_found, leads_created, error_message, created_at, finished_at, workspace:workspaces(name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("discovery_profiles").select("workspace_id"),
  ]);

  const configuredProviders = new Set<string>((credentials ?? []).map((c) => c.provider));
  const allJobs = jobs ?? [];
  const failedRecent = allJobs.filter((j) => j.status === "failed");
  const running = allJobs.filter((j) => j.status === "running" || j.status === "queued");
  const totalCompaniesFound = allJobs.reduce((sum, j) => sum + j.companies_found, 0);
  const totalLeadsCreated = allJobs.reduce((sum, j) => sum + j.leads_created, 0);
  const workspacesUsingDiscovery = new Set((workspaceCounts ?? []).map((w) => w.workspace_id)).size;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Discovery"
        description="Source connections, job status, and reliability for the AI Lead Discovery Agent across every workspace."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Workspaces using it" value={workspacesUsingDiscovery} icon={Building2} />
        <StatCard label="Jobs in progress" value={running.length} icon={Loader2} />
        <StatCard label="Failed (recent)" value={failedRecent.length} icon={AlertTriangle} />
        <StatCard label="Companies found (recent)" value={totalCompaniesFound} icon={Target} />
        <StatCard label="Leads created (recent)" value={totalLeadsCreated} icon={CircleCheck} />
      </div>

      <p className="text-xs text-muted-foreground">
        Per-token Claude qualification cost isn&apos;t wired into usage_records/pricing_settings yet - job counts and
        found/created totals above are real, but there&apos;s no dollar figure here to avoid showing an estimate as fact.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source connections</CardTitle>
          <CardDescription>
            Only &quot;Connected&quot; sources ever run live discovery. Everything else is a stub that fails loudly with a
            clear message rather than fabricating results. Add keys in{" "}
            <Link href="/super-admin/settings/apis" className="text-primary hover:underline">
              Settings → APIs
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credential configured</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sources ?? []).map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{source.category.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge variant={SOURCE_STATUS_VARIANT[source.status]}>{source.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    {source.credential_provider ? (
                      configuredProviders.has(source.credential_provider) ? (
                        <Badge variant="success">Configured</Badge>
                      ) : (
                        <Badge variant="secondary">Not set</Badge>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">Not needed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent jobs</CardTitle>
          <CardDescription>Last 100 discovery jobs across every workspace, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {allJobs.length === 0 ? (
            <EmptyState title="No jobs yet" description="Discovery jobs run by any workspace will show up here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Found / Created</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allJobs.map((job) => {
                  const workspace = job.workspace as unknown as { name: string } | null;
                  return (
                    <TableRow key={job.id}>
                      <TableCell>{workspace?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{job.source_key}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{job.trigger}</TableCell>
                      <TableCell>
                        <Badge variant={JOB_STATUS_VARIANT[job.status]}>{job.status}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {job.companies_found} / {job.leads_created}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-xs text-destructive" title={job.error_message ?? undefined}>
                        {job.error_message ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
