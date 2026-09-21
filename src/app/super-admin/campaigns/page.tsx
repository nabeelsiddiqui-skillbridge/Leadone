import type { Metadata } from "next";
import { Megaphone } from "lucide-react";

import { AdminPlaceholderPage } from "@/components/super-admin/placeholder-page";

export const metadata: Metadata = { title: "Super Admin | Campaigns" };

export default function SuperAdminCampaignsPage() {
  return (
    <AdminPlaceholderPage
      title="Campaigns"
      description="Platform-wide campaign management ships in a later phase."
      icon={Megaphone}
    />
  );
}
