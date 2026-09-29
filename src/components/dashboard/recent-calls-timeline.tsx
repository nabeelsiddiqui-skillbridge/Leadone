import { formatDistanceToNowStrict } from "date-fns";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  PhoneCall,
  PhoneOff,
  Voicemail,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface RecentCallItem {
  id: string;
  status: string;
  outcome: string | null;
  durationSeconds: number | null;
  createdAt: string;
  contactName: string;
  agentName: string | null;
}

const OUTCOME_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  appointment_booked: { label: "Booked meeting", icon: CalendarCheck, className: "bg-chart-2/15 text-chart-2" },
  qualified: { label: "Qualified", icon: CheckCircle2, className: "bg-primary/10 text-primary" },
  not_interested: { label: "Not interested", icon: XCircle, className: "bg-destructive/10 text-destructive" },
  follow_up_needed: { label: "Follow up needed", icon: Clock, className: "bg-warning/15 text-warning" },
  no_decision: { label: "No decision", icon: HelpCircle, className: "bg-muted text-muted-foreground" },
  wrong_number: { label: "Wrong number", icon: PhoneOff, className: "bg-destructive/10 text-destructive" },
  voicemail: { label: "Voicemail", icon: Voicemail, className: "bg-chart-3/15 text-chart-3" },
  incomplete: { label: "Incomplete", icon: HelpCircle, className: "bg-muted text-muted-foreground" },
};

function statusMeta(status: string): { label: string; icon: LucideIcon; className: string } {
  if (status === "completed") return { label: "Completed", icon: CheckCircle2, className: "bg-primary/10 text-primary" };
  if (["failed", "canceled"].includes(status)) {
    return { label: status === "failed" ? "Failed" : "Canceled", icon: PhoneOff, className: "bg-destructive/10 text-destructive" };
  }
  if (["ringing", "initiated", "queued", "in_progress"].includes(status)) {
    return { label: "In progress", icon: Clock, className: "bg-chart-2/15 text-chart-2" };
  }
  return { label: status, icon: PhoneCall, className: "bg-muted text-muted-foreground" };
}

function callMeta(call: RecentCallItem) {
  if (call.outcome && OUTCOME_META[call.outcome]) return OUTCOME_META[call.outcome];
  return statusMeta(call.status);
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecentCallsTimeline({ calls }: { calls: RecentCallItem[] }) {
  return (
    <ul className="flex flex-col">
      {calls.map((call, index) => {
        const meta = callMeta(call);
        const Icon = meta.icon;
        const duration = formatDuration(call.durationSeconds);
        const isLast = index === calls.length - 1;

        return (
          <li key={call.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span className="absolute top-9 left-[15px] h-[calc(100%-2.25rem)] w-px bg-border" aria-hidden />
            )}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                meta.className
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{call.contactName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {meta.label}
                  {call.agentName ? ` · ${call.agentName}` : ""}
                  {duration ? ` · ${duration}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                {formatDistanceToNowStrict(new Date(call.createdAt), { addSuffix: true })}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
