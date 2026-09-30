import "server-only";

import type { DiscoverySourceConnector } from "@/lib/discovery/types";
import { customerCsvSource } from "@/lib/discovery/sources/customerCsv";
import { googlePlacesSource, hunterIoSource, jobPostingsSource, newsFundingSource } from "@/lib/discovery/sources/stubs";

const CONNECTORS: Record<string, DiscoverySourceConnector> = {
  customer_csv: customerCsvSource,
  google_places: googlePlacesSource,
  hunter_io: hunterIoSource,
  job_postings: jobPostingsSource,
  news_funding: newsFundingSource,
};

export function getDiscoverySourceConnector(key: string): DiscoverySourceConnector | null {
  return CONNECTORS[key] ?? null;
}
