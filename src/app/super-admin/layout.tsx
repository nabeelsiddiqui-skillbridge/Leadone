import type { ReactNode } from "react";

import { requireSuperAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/super-admin/admin-shell";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  // Defense in depth: src/proxy.ts + src/lib/supabase/proxy.ts already gate
  // /super-admin at the middleware level, redirecting non-admins to /dashboard.
  const { user, profile } = await requireSuperAdmin();

  return (
    <AdminShell fullName={profile?.full_name ?? null} email={user.email ?? null}>
      {children}
    </AdminShell>
  );
}
