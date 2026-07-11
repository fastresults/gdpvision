import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { getSiteMode, type SiteMode } from "./site-mode";

export const getRequestSiteMode = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ mode: SiteMode; host: string }> => {
    let host = "";
    try {
      host =
        getRequestHeader("x-forwarded-host") ||
        getRequestHeader("host") ||
        getRequestHost({ xForwardedHost: true }) ||
        "";
    } catch {
      host = "";
    }
    return { mode: getSiteMode(host), host };
  },
);
