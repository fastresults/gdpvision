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

const MARKETING_HOSTS = new Set(["gdpvision.com", "www.gdpvision.com"]);

export function getSiteMode(host: string | null | undefined): SiteMode {
  if (!host) return "present";
  const normalized = host.toLowerCase().split(":")[0];
  return MARKETING_HOSTS.has(normalized) ? "marketing" : "present";
}

export function getClientSiteMode(): SiteMode {
  if (typeof window === "undefined") return "present";
  return getSiteMode(window.location.hostname);
}
