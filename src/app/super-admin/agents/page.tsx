import type { Metadata } from "next";
import { Bot } from "lucide-react";

import { AdminPlaceholderPage } from "@/components/super-admin/placeholder-page";

export const metadata: Metadata = { title: "Super Admin | Agents" };

export default function SuperAdminAgentsPage() {
  return (
    <AdminPlaceholderPage
      title="Agents"
      description="Platform-wide agent management ships in a later phase."
      icon={Bot}
    />
  );
}
