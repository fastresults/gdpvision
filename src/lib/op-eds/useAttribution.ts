import { useEffect, useRef, useState } from "react";
import { trackOpEdEvent } from "@/lib/op-eds/request.functions";

const KEY = "gdpv.attribution";

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  referrer?: string;
  visitorKey?: string;
}

function randomKey(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Reads campaign tags off the URL on first paint and holds them for the visit.
 * First-party only — nothing leaves the origin.
 */
export function useAttribution(): Attribution {
  const [attr, setAttr] = useState<Attribution>({});

  useEffect(() => {
    let stored: Attribution = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Attribution;
    } catch {
      stored = {};
    }

    const params = new URLSearchParams(window.location.search);
    const fresh: Attribution = {
      utm_source: params.get("utm_source") ?? stored.utm_source,
      utm_medium: params.get("utm_medium") ?? stored.utm_medium,
      utm_campaign: params.get("utm_campaign") ?? stored.utm_campaign,
      utm_content: params.get("utm_content") ?? stored.utm_content,
      referrer: stored.referrer || document.referrer || undefined,
      visitorKey: stored.visitorKey || randomKey(),
    };

    try {
      sessionStorage.setItem(KEY, JSON.stringify(fresh));
    } catch {
      /* private mode — attribution is best-effort */
    }
    setAttr(fresh);
  }, []);

  return attr;
}

type OpEdEvent =
  | "op_ed_view"
  | "op_ed_scroll_to_form"
  | "op_ed_submit"
  | "op_ed_pdf_open"
  | "op_ed_briefing_click";

/** Fire-and-forget event capture. Never blocks or breaks the page. */
export function useOpEdTracker(slug: string, attr: Attribution) {
  const sent = useRef<Set<string>>(new Set());

  return (event: OpEdEvent, once = false) => {
    if (once) {
      if (sent.current.has(event)) return;
      sent.current.add(event);
    }
    void trackOpEdEvent({ data: { slug, event, ...attr } }).catch(() => {});
  };
}
