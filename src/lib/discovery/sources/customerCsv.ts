import "server-only";

import type { DiscoveredCompanyDraft, DiscoverySourceConnector, DiscoverySourceRunContext } from "@/lib/discovery/types";

export interface CustomerCsvRow {
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  companySize?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

/**
 * The one real, always-available discovery source: a company list the
 * workspace already has permission to reach out to (their own list, a
 * purchased list they uploaded elsewhere, a trade show scan, etc). No API
 * key, no scraping - the "evidence" for every company here is simply that
 * the customer provided it themselves.
 */
export const customerCsvSource: DiscoverySourceConnector = {
  key: "customer_csv",
  async run(ctx: DiscoverySourceRunContext): Promise<DiscoveredCompanyDraft[]> {
    const rows = (ctx.input?.rows as CustomerCsvRow[] | undefined) ?? [];

    return rows
      .filter((row) => row.name && row.name.trim().length > 0)
      .map((row): DiscoveredCompanyDraft => ({
        name: row.name.trim(),
        website: row.website?.trim() || null,
        industry: row.industry?.trim() || null,
        location: row.location?.trim() || null,
        companySize: row.companySize?.trim() || null,
        sourceUrl: null,
        rawData: { ...row },
        signals: [
          {
            signalType: "customer_provided",
            description: row.notes?.trim()
              ? `Provided by you: ${row.notes.trim()}`
              : "Provided directly by you as a company to reach out to.",
          },
        ],
        contacts:
          row.contactName || row.contactEmail || row.contactPhone
            ? [
                {
                  name: row.contactName?.trim() || null,
                  title: row.contactTitle?.trim() || null,
                  email: row.contactEmail?.trim() || null,
                  phone: row.contactPhone?.trim() || null,
                  verified: true,
                },
              ]
            : [],
      }));
  },
};
