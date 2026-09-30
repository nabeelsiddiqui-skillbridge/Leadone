import "server-only";

/** Normalizes a URL/website string to a bare lowercase hostname, or null if unparseable. */
export function normalizeDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The dedup key a company is matched on within a workspace (see the unique
 * (workspace_id, dedup_key) constraint on discovered_companies). Prefers the
 * normalized domain - the same business showing up via two different
 * sources/spellings still collapses to one row as long as the website
 * matches. Falls back to a slugified name when no website is known.
 */
export function dedupKeyFor(name: string, website?: string | null): string {
  const domain = normalizeDomain(website);
  return domain ?? `name:${slugifyName(name)}`;
}
