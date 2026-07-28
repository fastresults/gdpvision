// @domain executive
// @tables none
// @ui src/components/executive/*
//
// The ChamberSummary DTO — the single contract every chamber resolver must
// satisfy. Adding a chamber surface means adding a resolver that returns this
// shape; the Executive Dashboard reads nothing else.

export type Tone = "neutral" | "positive" | "caution" | "negative" | "quiet";

/** One of the three numbers on a chamber card face. */
export interface KpiCell {
  label: string;
  /** Pre-formatted for display. `null` renders the empty-state contract. */
  value: string | null;
  tone?: Tone;
}

export interface ActivityLine {
  at: string;
  text: string;
}

export interface NextDue {
  label: string;
  at: string | null;
}

/** A thing that may need the Principal. Ranked by `severity` in attention.ts. */
export interface ChamberAlert {
  chamber: string;
  text: string;
  severity: number;
  /** Why this ranked where it did — surfaced on hover. */
  because: string[];
}

export type ChamberRoute =
  | "/admin/countries/$code/ledger"
  | "/admin/countries/$code/portfolio"
  | "/admin/countries/$code/scenarios"
  | "/admin/countries/$code/studio"
  | "/admin/countries/$code/narrative"
  | "/admin/countries/$code/cabinet"
  | "/admin/countries/$code/personas"
  | "/admin/countries/$code/mandate-compact";

export interface ChamberSummary {
  index: string;
  title: string;
  to: ChamberRoute;
  owner: string;
  kpis: KpiCell[];
  /** 30 daily activity counts, oldest first. */
  tempo: number[];
  last_activity_at: string | null;
  next_due: NextDue | null;
  recent: ActivityLine[];
  alerts: ChamberAlert[];
  health: Tone;
}

export interface ExecutiveMasthead {
  code: string;
  name: string | null;
  currency: string | null;
  gdp_usd: number | null;
  gdp_year: number | null;
  /** Share of KPI series carrying an A or B confidence grade, 0–1. */
  grade_ab: number | null;
  corpus_fresh_at: string | null;
}

export interface ExecutiveDashboardDTO {
  masthead: ExecutiveMasthead;
  chambers: ChamberSummary[];
  generated_at: string;
}

export const TEMPO_DAYS = 30;

/** Buckets timestamps into TEMPO_DAYS daily counts, oldest first. */
export function bucketTempo(stamps: (string | null | undefined)[]): number[] {
  const out = new Array(TEMPO_DAYS).fill(0);
  const now = Date.now();
  for (const s of stamps) {
    if (!s) continue;
    const t = Date.parse(s);
    if (Number.isNaN(t)) continue;
    const daysAgo = Math.floor((now - t) / 86_400_000);
    if (daysAgo < 0 || daysAgo >= TEMPO_DAYS) continue;
    out[TEMPO_DAYS - 1 - daysAgo] += 1;
  }
  return out;
}

export function newest(stamps: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const s of stamps) {
    if (!s) continue;
    if (!best || Date.parse(s) > Date.parse(best)) best = s;
  }
  return best;
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/** A chamber that failed to resolve renders quiet rather than blanking the grid. */
export function emptyChamber(
  index: string,
  title: string,
  to: ChamberRoute,
  owner: string,
  labels: [string, string, string],
): ChamberSummary {
  return {
    index,
    title,
    to,
    owner,
    kpis: labels.map((label) => ({ label, value: null, tone: "quiet" as Tone })),
    tempo: new Array(TEMPO_DAYS).fill(0),
    last_activity_at: null,
    next_due: null,
    recent: [],
    alerts: [],
    health: "quiet",
  };
}
