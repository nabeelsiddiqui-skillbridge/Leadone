import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhoneNumberProvisioner } from "@/components/super-admin/phone-number-provisioner";

export const metadata: Metadata = { title: "Super Admin | Phone Numbers" };

export default async function SuperAdminPhoneNumbersPage() {
  await requireSuperAdmin();
  const db = createServiceRoleClient();

  const [{ data: workspaces }, { data: numbers }] = await Promise.all([
    db.from("workspaces").select("id, name").eq("status", "active").order("name"),
    db
      .from("phone_numbers")
      .select("id, phone_number, friendly_name, status, is_default, created_at, workspace:workspaces(id, name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Phone Numbers"
        description="Purchase Twilio numbers on the platform's account and hand them straight to a workspace."
      />

      <PhoneNumberProvisioner workspaces={(workspaces ?? []).map((w) => ({ id: w.id, name: w.name }))} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All numbers</CardTitle>
          <CardDescription>The 50 most recently added numbers across every workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {!numbers || numbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No phone numbers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((n) => {
                  const workspace = n.workspace as unknown as { id: string; name: string } | null;
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">
                        {n.phone_number}
                        {n.is_default && (
                          <Badge variant="secondary" className="ml-2">
                            Default
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{workspace?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={n.status === "active" ? "success" : "secondary"}>{n.status}</Badge>
                      </TableCell>
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
