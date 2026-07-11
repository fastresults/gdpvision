import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getHeaders } from "@tanstack/react-start/server";
import { getSiteMode, type SiteMode } from "./site-mode";

export const getRequestSiteMode = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ mode: SiteMode; host: string }> => {
    let host = "";
    try {
      const headers = getHeaders() ?? {};
      const xfh = headers["x-forwarded-host"];
      const h = headers["host"];
      host =
        (typeof xfh === "string" ? xfh : Array.isArray(xfh) ? xfh[0] : "") ||
        (typeof h === "string" ? h : Array.isArray(h) ? h[0] : "") ||
        (getRequestHost() ?? "");
    } catch {
      host = "";
    }
    return { mode: getSiteMode(host), host };
  },
);
