import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PageHeader } from "@/components/shared/page-header";
import { PlanEditCard } from "@/components/super-admin/plan-edit-card";

export const metadata: Metadata = { title: "Super Admin | Plans" };

export default async function SuperAdminPlansPage() {
  await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { data: plans } = await db.from("plans").select("*").order("sort_order");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plans"
        description="The 3 packages workspaces can be assigned to. Editing a plan here only changes the catalog — use a workspace's Plan card to move it onto a plan."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((plan) => (
          <PlanEditCard
            key={plan.key}
            plan={{
              key: plan.key,
              name: plan.name,
              description: plan.description,
              price_cents: plan.price_cents,
              max_agents: plan.max_agents,
              max_campaigns: plan.max_campaigns,
              max_contacts: plan.max_contacts,
              concurrent_calls: plan.concurrent_calls,
              monthly_minutes: plan.monthly_minutes,
            }}
          />
        ))}
      </div>
    </div>
  );
}
