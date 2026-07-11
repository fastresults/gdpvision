import { getSiteMode, PRESENT_HOST, type SiteMode } from "./site-mode";

export function getHostFromRequest(request: Request): string {
  const forwarded = request.headers.get("forwarded") ?? "";
  for (const part of forwarded.split(",")) {
    const hostPair = part
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.toLowerCase().startsWith("host="));
    if (hostPair) return hostPair.slice(5).replace(/^"|"$/g, "");
  }
  const forwardedHost = request.headers.get("x-forwarded-host") ?? "";
  const originalHost = request.headers.get("x-original-host") ?? "";
  const realHost = request.headers.get("x-real-host") ?? "";
  const xHost = request.headers.get("x-host") ?? "";
  const host = request.headers.get("host") ?? "";
  if (forwardedHost) return forwardedHost.split(",")[0].trim();
  if (originalHost) return originalHost.split(",")[0].trim();
  if (realHost) return realHost.split(",")[0].trim();
  if (xHost) return xHost.split(",")[0].trim();
  if (host) return host.split(",")[0].trim();
  try {
    return new URL(request.url).host;
  } catch {
    return "";
  }
}

export function getSiteModeForRequest(request: Request): SiteMode {
  return getSiteMode(getHostFromRequest(request));
}

export function blockMarketingRequest(request: Request): Response | null {
  if (getSiteModeForRequest(request) !== "marketing") return null;
  return Response.json(
    { error: "This GDP Vision app endpoint is only available on present.gdpvision.com." },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-GDP-Vision-Host-Guard": "present-only",
      },
    },
  );
}

export function getPresentUrlForRequest(request: Request, pathname?: string): string {
  const url = new URL(request.url);
  url.protocol = "https:";
  url.hostname = PRESENT_HOST;
  url.port = "";
  if (pathname) url.pathname = pathname;
  return url.toString();
}
