// @domain marketing
// @ui src/components/calculator/ValueCalculator.tsx
//
// The Decision Brief's configuration, carried in the URL so a brief can be
// reopened exactly as it was left: the stance, the eight framing answers and
// the ten adoption levels. Compact and readable: `cfg=c_24_6_35_40_60_30_27_2100-4332211000`.
// Nothing personal, nothing from the record; the facts are re-read on open.
//
// Layout (underscore-separated, then a dash and one digit per chamber, 0–4 quarters):
//   stance · decisionsPerQuarter · latencyMonths · unmeasuredPct ·
//   topSectorSharePct · servicesOfflinePct · unplannedPrioritySharePct ·
//   publicSpendPct · gdp (US$ m)

import { CHAMBER_COEFFICIENTS, type Stance, type ValueInput } from "./model";

const STANCE_CODE: Record<Stance, string> = { conservative: "k", central: "c", optimistic: "o" };
const CODE_STANCE: Record<string, Stance> = { k: "conservative", c: "central", o: "optimistic" };

const num = (v: number) => String(Math.round(v * 10) / 10);

export function encodeBrief(input: ValueInput): string {
  const head = [
    STANCE_CODE[input.stance],
    num(input.decisionsPerQuarter),
    num(input.latencyMonths),
    num(input.unmeasuredPct),
    num(input.topSectorSharePct),
    num(input.servicesOfflinePct),
    num(input.unplannedPrioritySharePct),
    num(input.publicSpendPct),
    String(Math.round(input.gdpUsd / 1_000_000)),
  ].join("_");
  const tail = CHAMBER_COEFFICIENTS.map((c) =>
    String(Math.max(0, Math.min(4, Math.round((input.chambers[c.index] ?? 0) / 25)))),
  ).join("");
  return `${head}-${tail}`;
}

/** Returns the parts of the input the link carries, or null if it is malformed. */
export function decodeBrief(cfg: string | undefined | null): ValueInput | null {
  if (!cfg || cfg.length > 120) return null;
  const [head, tail] = cfg.split("-");
  if (!head || !tail || !/^[0-4]+$/.test(tail)) return null;
  const parts = head.split("_");
  if (parts.length !== 9) return null;
  const stance = CODE_STANCE[parts[0]!];
  const n = parts.slice(1).map(Number);
  if (!stance || n.some((x) => !Number.isFinite(x) || x < 0)) return null;
  const [dpq, lat, unm, top, off, unpl, spend, gdpM] = n as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const chambers: Record<string, number> = {};
  CHAMBER_COEFFICIENTS.forEach((c, i) => {
    chambers[c.index] = Number(tail[i] ?? 0) * 25;
  });
  return {
    stance,
    decisionsPerQuarter: Math.min(dpq, 200),
    latencyMonths: Math.min(lat, 36),
    unmeasuredPct: Math.min(unm, 80),
    topSectorSharePct: Math.min(top, 100),
    servicesOfflinePct: Math.min(off, 100),
    unplannedPrioritySharePct: Math.min(unpl, 80),
    publicSpendPct: Math.min(spend, 60),
    gdpUsd: Math.min(gdpM, 100_000_000) * 1_000_000,
    chambers,
  };
}

export function briefUrl(origin: string, code: string, input: ValueInput): string {
  return `${origin}/business-case/brief?country=${encodeURIComponent(code)}&cfg=${encodeURIComponent(encodeBrief(input))}`;
}
