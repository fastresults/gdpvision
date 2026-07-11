// Host-based site mode.
//
// The same deployment serves two "sites":
//   - "present"   → the kiosk / admin app (present.gdpvision.com, previews, localhost)
//   - "marketing" → the public marketing website (gdpvision.com, www.gdpvision.com)
//
// Rule: ONLY the bare apex + www route to marketing. Everything else
// (preview URLs, lovable.app subdomains, localhost, present.gdpvision.com)
// keeps rendering the app so the existing preview experience is preserved.

export type SiteMode = "present" | "marketing";

export const PRESENT_HOST = "present.gdpvision.com";
export const MARKETING_HOSTS = new Set(["gdpvision.com", "www.gdpvision.com"]);

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.toLowerCase().split(",")[0].trim().split(":")[0];
}

export function getSiteMode(host: string | null | undefined): SiteMode {
  const normalized = normalizeHost(host);
  if (!normalized) return "present";
  return MARKETING_HOSTS.has(normalized) ? "marketing" : "present";
}

export function isMarketingHost(host: string | null | undefined): boolean {
  return getSiteMode(host) === "marketing";
}

export function getClientSiteMode(): SiteMode {
  if (typeof window === "undefined") return "present";
  return getSiteMode(window.location.hostname);
}
