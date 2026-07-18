// Chamber 05 — derived response-priority triage.
// 5 levels, computed from what we already store on intake_items.
import type { SignalRow, SignalRecommendation } from "@/lib/narrative-chamber.functions";

export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

export interface PriorityMeta {
  level: PriorityLevel;
  key: `p${PriorityLevel}`;
  label: string;
  caption: string;
  tone: "rose" | "amber" | "emerald" | "slate" | "muted";
  pillClass: string;
  borderClass: string;
}

export const PRIORITY_ORDER: PriorityLevel[] = [1, 2, 3, 4, 5];

export const PRIORITY_META: Record<PriorityLevel, PriorityMeta> = {
  1: {
    level: 1,
    key: "p1",
    label: "P1 · Respond now",
    caption: "Immediate action",
    tone: "rose",
    pillClass: "border-rose-500 bg-rose-600 text-paper-0",
    borderClass: "border-l-rose-500",
  },
  2: {
    level: 2,
    key: "p2",
    label: "P2 · Prepare response",
    caption: "Draft within 24h",
    tone: "amber",
    pillClass: "border-amber-500 bg-amber-500 text-ink-950",
    borderClass: "border-l-amber-500",
  },
  3: {
    level: 3,
    key: "p3",
    label: "P3 · Amplify",
    caption: "Ride the wave",
    tone: "emerald",
    pillClass: "border-emerald-600 bg-emerald-600 text-paper-0",
    borderClass: "border-l-emerald-500",
  },
  4: {
    level: 4,
    key: "p4",
    label: "P4 · Monitor",
    caption: "Track only",
    tone: "slate",
    pillClass: "border-ink-700 bg-ink-800 text-paper-0",
    borderClass: "border-l-ink-500",
  },
  5: {
    level: 5,
    key: "p5",
    label: "P5 · Noise",
    caption: "Ignore",
    tone: "muted",
    pillClass: "border-line-200 bg-paper-100 text-ink-500",
    borderClass: "border-l-line-200",
  },
};

function level(rec: SignalRecommendation | null | undefined, sev: number, reach: number): PriorityLevel {
  if (rec === "lead" || rec === "counter") {
    return sev >= 4 || reach >= 4 ? 1 : 2;
  }
  if (rec === "amplify") {
    return sev >= 4 ? 2 : 3;
  }
  if (rec === "monitor") return 4;
  if (rec === "ignore") return 5;
  // no recommendation: use severity/reach to guess
  if (sev >= 4 || reach >= 4) return 2;
  if (sev >= 2 || reach >= 2) return 4;
  return 5;
}

export function priorityFor(signal: {
  recommendation: SignalRecommendation | null;
  severity: number | null;
  reach: number | null;
  created_at?: string;
}): PriorityMeta & { score: number } {
  const sev = signal.severity ?? 0;
  const reach = signal.reach ?? 0;
  const lvl = level(signal.recommendation, sev, reach);
  const meta = PRIORITY_META[lvl];
  // Lower score = higher priority for ascending sort.
  const ageHrs = signal.created_at
    ? Math.max(0, (Date.now() - new Date(signal.created_at).getTime()) / 3_600_000)
    : 0;
  const recencyPenalty = Math.min(50, ageHrs); // older signals drift down within a level
  const score = lvl * 1000 - sev * 20 - reach * 10 + recencyPenalty;
  return { ...meta, score };
}

export type SortKey = "priority" | "newest" | "severity" | "reach" | "sentiment";

export function sortSignals(rows: SignalRow[], key: SortKey): SignalRow[] {
  const arr = [...rows];
  switch (key) {
    case "newest":
      return arr.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    case "severity":
      return arr.sort((a, b) => (b.severity ?? -1) - (a.severity ?? -1));
    case "reach":
      return arr.sort((a, b) => (b.reach ?? -1) - (a.reach ?? -1));
    case "sentiment":
      return arr.sort((a, b) => (a.sentiment ?? 0) - (b.sentiment ?? 0));
    case "priority":
    default:
      return arr.sort((a, b) => priorityFor(a).score - priorityFor(b).score);
  }
}

export function filterSignals(rows: SignalRow[], q: string): SignalRow[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) => {
    const hay = [r.topic, r.summary ?? "", r.sector_code ?? "", r.url ?? "", r.scope ?? ""].join(" ").toLowerCase();
    return hay.includes(s);
  });
}

export function countsByPriority(rows: SignalRow[]): Record<PriorityLevel, number> {
  const out: Record<PriorityLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) out[priorityFor(r).level] += 1;
  return out;
}
