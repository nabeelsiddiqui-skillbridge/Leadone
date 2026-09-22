import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";
import type { VariantProps } from "class-variance-authority";

type AppointmentStatus = Database["public"]["Tables"]["appointments"]["Row"]["status"];
type CallbackStatus = Database["public"]["Tables"]["callbacks"]["Row"]["status"];
type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  rescheduled: "Rescheduled",
};

function appointmentVariant(status: AppointmentStatus): BadgeVariant {
  switch (status) {
    case "completed":
      return "success";
    case "cancelled":
    case "no_show":
      return "secondary";
    case "rescheduled":
      return "outline";
    default:
      return "default";
  }
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={appointmentVariant(status)}>{APPOINTMENT_LABELS[status]}</Badge>;
}

const CALLBACK_LABELS: Record<CallbackStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  missed: "Missed",
};

function callbackVariant(status: CallbackStatus): BadgeVariant {
  switch (status) {
    case "completed":
      return "success";
    case "cancelled":
    case "missed":
      return "secondary";
    default:
      return "default";
  }
}

export function CallbackStatusBadge({ status }: { status: CallbackStatus }) {
  return <Badge variant={callbackVariant(status)}>{CALLBACK_LABELS[status]}</Badge>;
}
