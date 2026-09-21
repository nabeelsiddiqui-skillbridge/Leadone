import type { Metadata } from "next";
import { Plug } from "lucide-react";

import { AdminPlaceholderPage } from "@/components/super-admin/placeholder-page";

export const metadata: Metadata = { title: "Super Admin | Settings · APIs" };

export default function SuperAdminSettingsApisPage() {
  return (
    <AdminPlaceholderPage
      title="Settings → APIs"
      description="Platform-wide API key and integration management ships in a later phase."
      icon={Plug}
    />
  );
}
