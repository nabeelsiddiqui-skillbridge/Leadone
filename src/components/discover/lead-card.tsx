"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  X,
  ExternalLink,
  MapPin,
  Users,
  TrendingUp,
  Rocket,
  MessageSquare,
  AlertTriangle,
  FileText,
  Sparkle,
  Target,
  Lightbulb,
  Loader2,
} from "lucide-react";

import { approveLeadAction, rejectLeadAction } from "@/app/(app)/discover/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ConvertToCampaignDialog } from "@/components/discover/convert-to-campaign-dialog";
import { cn } from "@/lib/utils";
import type { LeadCardData } from "@/components/discover/types";
import type { DiscoverySignalType } from "@/lib/supabase/database.types";

const SIGNAL_META: Record<DiscoverySignalType, { label: string; icon: typeof MapPin }> = {
  new_location: { label: "New location", icon: MapPin },
  hiring: { label: "Hiring", icon: Users },
  funding: { label: "Funding", icon: TrendingUp },
  product_launch: { label: "Product launch", icon: Rocket },
  public_post: { label: "Public post", icon: MessageSquare },
  website_issue: { label: "Website issue", icon: AlertTriangle },
  customer_provided: { label: "Your list", icon: FileText },
  other: { label: "Signal", icon: Sparkle },
};

/**
 * Guards against a `javascript:`/`data:` URI ending up in an href - evidence
 * URLs and company websites can eventually come from a data source we don't
 * fully control (the customer's own CSV today, a third-party connector once
 * one is implemented), so this is enforced at render time rather than
 * trusted from storage.
 */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function fitScoreBadgeClass(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 70) return "bg-success/15 text-success";
  if (score >= 40) return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

export function LeadCard({
  lead,
  agents,
}: {
  lead: LeadCardData;
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function handleApprove() {
    startTransition(async () => {
      const result = await approveLeadAction(lead.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Lead approved.");
        router.refresh();
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectLeadAction(lead.id, rejectReason);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Lead rejected.");
        setRejecting(false);
        router.refresh();
      }
    });
  }

  const websiteUrl = safeHttpUrl(lead.company.website);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{lead.company.name}</h3>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {[lead.company.industry, lead.company.location, lead.company.companySize ? `${lead.company.companySize} employees` : null]
              .filter(Boolean)
              .join(" · ") || "No company details recorded"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {lead.qualificationStatus === "qualified" ? (
            <>
              <Badge className={cn("border-transparent text-sm font-semibold", fitScoreBadgeClass(lead.fitScore))}>
                {lead.fitScore ?? "—"} fit
              </Badge>
              {lead.confidenceLevel && (
                <span className="text-[11px] capitalize text-muted-foreground">{lead.confidenceLevel} confidence</span>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              {lead.qualificationStatus === "unavailable" ? "Not qualified yet" : "Qualification error"}
            </Badge>
          )}
        </div>
      </div>

      {lead.detectedSignalSummary && (
        <div className="flex gap-2 text-sm">
          <Target className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">Why we found this</p>
            <p className="text-muted-foreground">{lead.detectedSignalSummary}</p>
          </div>
        </div>
      )}

      {lead.signals.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Evidence</p>
          {lead.signals.map((signal) => {
            const meta = SIGNAL_META[signal.signal_type] ?? SIGNAL_META.other;
            const Icon = meta.icon;
            const evidenceUrl = safeHttpUrl(signal.evidence_url);
            return (
              <div key={signal.id} className="flex items-start gap-2 text-sm">
                <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{signal.description}</span>
                {evidenceUrl && (
                  <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:underline">
                    source
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lead.reason && <p className="text-sm text-muted-foreground">{lead.reason}</p>}

      {lead.suggestedOutreachAngle && (
        <div className="flex gap-2 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">What to do next</p>
            <p className="text-muted-foreground">{lead.suggestedOutreachAngle}</p>
          </div>
        </div>
      )}

      {lead.contact && (lead.contact.name || lead.contact.phone || lead.contact.email) && (
        <p className="text-xs text-muted-foreground">
          Contact: {lead.contact.name ?? "Unknown"}
          {lead.contact.title ? `, ${lead.contact.title}` : ""}
          {lead.contact.phone ? ` · ${lead.contact.phone}` : ""}
          {lead.contact.email ? ` · ${lead.contact.email}` : ""}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        {lead.status === "new" && !rejecting && (
          <>
            <Button size="sm" onClick={handleApprove} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={pending}>
              <X /> Reject
            </Button>
          </>
        )}

        {lead.status === "new" && rejecting && (
          <div className="flex w-full flex-col gap-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why isn't this a fit? (optional, helps you tune future searches)"
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} Confirm reject
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {lead.status === "approved" && <ConvertToCampaignDialog leadId={lead.id} agents={agents} knownPhone={lead.contact?.phone ?? null} />}

        {lead.status === "converted" && (
          <Badge variant="secondary" className="gap-1">
            <Check className="size-3" /> Added to campaign
          </Badge>
        )}

        {lead.status === "rejected" && (
          <span className="text-xs text-muted-foreground">{lead.rejectReason ? `Rejected: ${lead.rejectReason}` : "Rejected"}</span>
        )}
      </div>
    </Card>
  );
}
