import type { ReactNode } from "react";

import { requireUser, requireCurrentWorkspace, getProfile } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const { workspace } = await requireCurrentWorkspace();
  const profile = await getProfile();

  return (
    <AppShell
      workspaceName={workspace.name}
      fullName={profile?.full_name ?? null}
      email={user.email ?? null}
      isSuperAdmin={profile?.platform_role === "super_admin"}
    >
      {children}
    </AppShell>
  );
}
