import type { Metadata } from "next";
import { PhoneCall } from "lucide-react";

import { AdminPlaceholderPage } from "@/components/super-admin/placeholder-page";

export const metadata: Metadata = { title: "Super Admin | Calls" };

export default function SuperAdminCallsPage() {
  return (
    <AdminPlaceholderPage
      title="Calls"
      description="Platform-wide call monitoring ships in a later phase."
      icon={PhoneCall}
    />
  );
}
