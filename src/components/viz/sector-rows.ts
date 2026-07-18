// Derive display rows for sector trend UI. Shared by cards and profiling matrix.

import type { VizOverview } from "@/lib/country-viz/viz.functions";
import {
  computeConfidence,
  computeMomentum,
  computeRisk,
  realToBuckets,
  syntheticBuckets,
  type Bucket,
  type MomentumLevel,
} from "./momentum";

export type SectorRow = {
  code: string;
  label: string;
  hue_token: string;
  share_pct: number;
  confidence_grade: string;
  kpi_label: string | null;
  kpi_code: string | null;
  latest: number | null;
  latest_period: string | null;
  target: number | null;
  unit: string | null;
  direction: string | null;
  freshness: string | null;
  buckets: Bucket[];
  hasSeries: boolean;
  momentum: MomentumLevel;
  risk: number;
  confidence: number;
};

export function buildSectorRows(
  countryCode: string,
  sectors: VizOverview["sectors"],
  series: VizOverview["sectorKpiSeries"],
  allKpis: VizOverview["allKpis"],
): SectorRow[] {
  return sectors.map((s) => {
    const s0 = series.find((x) => x.sector_code === s.code) ?? null;
    const kpi = s0 ? allKpis.find((k) => k.kpi_code === s0.kpi_code) ?? null : null;
    const hasSeries = !!s0 && s0.points.length >= 2;

    const latest = s0?.latest ?? kpi?.latest_value ?? null;
    const target = s0?.target ?? kpi?.target ?? null;
    const direction = kpi?.direction ?? "higher_is_better";
    const freshness = kpi?.freshness_status ?? null;

    const buckets = hasSeries
      ? realToBuckets(s0!.points, 24)
      : syntheticBuckets(`${countryCode}::${s.code}`, {
          latest,
          target,
          direction,
          sharePct: s.share_pct,
          n: 24,
        });

    const { level } = computeMomentum(buckets);
    const risk = computeRisk({ momentum: level, direction, latest, target, freshness });
    const confidence = computeConfidence({
      grade: s.confidence_grade,
      freshness,
      hasTarget: target != null,
      hasSeries,
    });

    return {
      code: s.code,
      label: s.label,
      hue_token: s.hue_token,
      share_pct: s.share_pct,
      confidence_grade: s.confidence_grade,
      kpi_label: s0?.label ?? kpi?.label ?? null,
      kpi_code: s0?.kpi_code ?? null,
      latest,
      latest_period: kpi?.latest_period ?? null,
      target,
      unit: s0?.unit ?? kpi?.unit ?? null,
      direction,
      freshness,
      buckets,
      hasSeries,
      momentum: level,
      risk,
      confidence,
    };
  });
}

export function momentumChipClass(m: MomentumLevel): string {
  if (m === "accelerating") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (m === "decelerating") return "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "border-line-200 bg-paper-0 text-ink-700";
}

export function riskDotClasses(risk: number): string[] {
  // 3 dots, filled left→right; color escalates with risk.
  return [0, 1, 2].map((i) => {
    if (i >= risk) return "bg-line-200";
    if (risk === 1) return "bg-emerald-500";
    if (risk === 2) return "bg-amber-500";
    return "bg-rose-500";
  });
}
