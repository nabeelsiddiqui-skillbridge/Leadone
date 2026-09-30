import "server-only";

import type { Database, DiscoverySignalType } from "@/lib/supabase/database.types";

export type DiscoveryProfileRow = Database["public"]["Tables"]["discovery_profiles"]["Row"];

export interface DiscoveredSignalDraft {
  signalType: DiscoverySignalType;
  description: string;
  evidenceUrl?: string | null;
  observedAt?: string;
}

export interface DiscoveredContactDraft {
  name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  sourceUrl?: string | null;
  verified?: boolean;
  rawData?: Record<string, unknown>;
}

export interface DiscoveredCompanyDraft {
  name: string;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  companySize?: string | null;
  sourceUrl?: string | null;
  rawData?: Record<string, unknown>;
  signals: DiscoveredSignalDraft[];
  contacts: DiscoveredContactDraft[];
}

export interface DiscoverySourceRunContext {
  workspaceId: string;
  profile: DiscoveryProfileRow;
  jobId: string;
  /** Source-specific input - e.g. the parsed rows for a customer_csv upload. Sources that need none (an API-backed connector reading from the profile alone) ignore this. */
  input?: Record<string, unknown>;
}

/**
 * A discovery source connector turns "go look for companies matching this
 * profile" into a list of company drafts with their evidence. A connector
 * whose API key isn't configured must throw a clear, specific error - never
 * return a fabricated or empty-but-successful result that could be mistaken
 * for "we looked and found nothing."
 */
export interface DiscoverySourceConnector {
  key: string;
  run(ctx: DiscoverySourceRunContext): Promise<DiscoveredCompanyDraft[]>;
}
