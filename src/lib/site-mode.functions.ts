import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { getSiteMode, normalizeHost, PRESENT_HOST, type SiteMode } from "./site-mode";

export const getRequestSiteMode = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ mode: SiteMode; host: string }> => {
    const hosts: string[] = [];
    try {
      const request = getRequest();
      hosts.push(
        getRequestHeader("x-forwarded-host") || "",
        getRequestHeader("host") || "",
        request ? new URL(request.url).host : "",
        getRequestHost({ xForwardedHost: true }) || "",
      );
    } catch {
      // Keep default present behavior if request metadata is unavailable.
    }

    const normalizedHosts = hosts.map(normalizeHost).filter(Boolean);
    const host = normalizedHosts[0] ?? "";
    if (normalizedHosts.includes(PRESENT_HOST)) return { mode: "present", host: PRESENT_HOST };

    return { mode: getSiteMode(host), host };
  },
);
