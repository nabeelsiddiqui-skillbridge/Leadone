import "server-only";

import { resolveCredential, type CredentialProvider } from "@/lib/credentials";
import type { DiscoverySourceConnector, DiscoverySourceRunContext } from "@/lib/discovery/types";

/**
 * Builds a connector for an API-backed source that isn't implemented yet.
 * It always checks for a configured credential first and fails loudly and
 * specifically either way - "no API key" vs "key is set but this connector
 * isn't wired up yet" - rather than silently returning an empty or
 * fabricated result. Nothing here calls a third-party API, scrapes a page,
 * or invents data; per-source real implementations get filled in behind
 * this same DiscoverySourceConnector interface once a provider is chosen
 * and its API contract is read (see the module comment in index.ts).
 */
function stubConnector(key: string, displayName: string, credentialProvider: CredentialProvider): DiscoverySourceConnector {
  return {
    key,
    async run(ctx: DiscoverySourceRunContext) {
      const apiKey = await resolveCredential(ctx.workspaceId, credentialProvider, "api_key");
      if (!apiKey) {
        throw new Error(
          `${displayName} isn't connected yet - no API key is configured. Add one in Super Admin → Settings → APIs, or use "Your own company list" instead.`
        );
      }
      throw new Error(
        `${displayName}'s API key is configured, but this connector hasn't been implemented yet. It's registered as a source so it's visible in admin, but it does not run live discovery.`
      );
    },
  };
}

export const googlePlacesSource = stubConnector("google_places", "Google Places", "google_places");
export const hunterIoSource = stubConnector("hunter_io", "Hunter.io", "hunter_io");
export const jobPostingsSource = stubConnector("job_postings", "Job posting signals", "job_postings");
export const newsFundingSource = stubConnector("news_funding", "News & funding signals", "news_funding");
