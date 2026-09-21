import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/lib/supabase/database.types";

const LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  stopped: "Stopped",
  error: "Error",
};

export function campaignStatusVariant(status: CampaignStatus) {
  switch (status) {
    case "running":
      return "success" as const;
    case "paused":
      return "warning" as const;
    case "error":
    case "stopped":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={campaignStatusVariant(status)}>{LABELS[status]}</Badge>;
}
