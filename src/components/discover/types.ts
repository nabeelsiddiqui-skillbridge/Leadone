import type {
  DiscoveredLeadStatus,
  DiscoveryConfidenceLevel,
  DiscoveryQualificationStatus,
  DiscoverySignalType,
} from "@/lib/supabase/database.types";

export interface LeadCardSignal {
  id: string;
  signal_type: DiscoverySignalType;
  description: string;
  evidence_url: string | null;
}

export interface LeadCardData {
  id: string;
  status: DiscoveredLeadStatus;
  fitScore: number | null;
  confidenceLevel: DiscoveryConfidenceLevel | null;
  detectedSignalSummary: string | null;
  reason: string | null;
  suggestedOutreachAngle: string | null;
  qualificationStatus: DiscoveryQualificationStatus;
  rejectReason: string | null;
  campaignId: string | null;
  createdAt: string;
  company: {
    name: string;
    website: string | null;
    industry: string | null;
    location: string | null;
    companySize: string | null;
    sourceKey: string;
  };
  contact: {
    name: string | null;
    title: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  signals: LeadCardSignal[];
}
