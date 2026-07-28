// @domain executive
// @tables none
// @ui src/components/executive/DetailModal.tsx
//
// The shape of anything a Principal can click on the brief or a room sheet.
// Presentation-only: every field is already carried by ChamberSummary, so a
// detail is assembled on the client and never re-fetched.

import type { ChamberSummary, KpiCell, Tone } from "./types";

export interface DetailOrigin {
  /** Chamber index, e.g. "03". Absent for masthead-level figures. */
  index?: string;
  title?: string;
  owner?: string;
}

export type ExecutiveDetail =
  | ({ kind: "kpi"; label: string; value: string | null; tone?: Tone; note?: string } & DetailOrigin)
  | ({ kind: "alert"; text: string; severity: number; because: string[] } & DetailOrigin)
  | ({ kind: "activity"; at: string | null; text: string } & DetailOrigin)
  | ({ kind: "due"; label: string; at: string | null; state: string } & DetailOrigin)
  | { kind: "chamber"; chamber: ChamberSummary };

export function kpiDetail(k: KpiCell, origin: DetailOrigin, note?: string): ExecutiveDetail {
  return { kind: "kpi", label: k.label, value: k.value, tone: k.tone, note, ...origin };
}

export function originOf(c: ChamberSummary): DetailOrigin {
  return { index: c.index, title: c.title, owner: c.owner };
}

/** The exact record line under the headline — "on record" provenance. */
export function exactStamp(iso: string | null): string {
  if (!iso) return "Not yet on record";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not yet on record";
  return d.toLocaleString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
