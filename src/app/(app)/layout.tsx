import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";

import { requireUser, requireCurrentWorkspace, getProfile } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

function serializeDiagError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack, cause: err.cause ? String(err.cause) : undefined };
  }
  return { raw: String(err) };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  let user, workspace, profile;
  try {
    user = await requireUser();
    ({ workspace } = await requireCurrentWorkspace());
    profile = await getProfile();
  } catch (err) {
    // redirect() (unauthenticated -> /login, no workspace -> /onboarding)
    // works by throwing - let that through untouched, only intercept real
    // errors.
    unstable_rethrow(err);
    // TEMPORARY: surface the real error instead of letting Next.js's
    // production scrubbing replace it with a bare digest we have no way to
    // look up (Vercel runtime log access is unavailable in this session).
    // This is the layout, not the page, so the page's own try/catch can't
    // reach an error thrown here. Remove once the root cause behind the
    // "Start calling" crash is fixed.
    console.error("AppLayout threw", err);
    return (
      <pre className="m-4 whitespace-pre-wrap break-all rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
        {JSON.stringify(serializeDiagError(err), null, 2)}
      </pre>
    );
  }

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
