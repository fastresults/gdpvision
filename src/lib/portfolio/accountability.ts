export type DeliveryStatus = "on" | "risk" | "off" | "unscored";

export type DeliveryKpi = {
  id: string;
  ministry_id: string | null;
  sector_code: string;
  metric: string;
  unit: string;
  baseline: number | null;
  baseline_period: string | null;
  target: number;
  target_period: string | null;
  direction: string;
  target_basis: string | null;
  evidence_url: string | null;
  cadence: string;
  warning_tolerance_pct: number;
  critical_tolerance_pct: number;
  verification_status: string;
  latest: { period: string; value: number | null; captured_at: string } | null;
};

export type DeliveryAssessment = {
  status: DeliveryStatus;
  expected: number | null;
  gapPct: number | null;
  reason: string | null;
  evidenceAgeDays: number | null;
};

const MAX_AGE_DAYS: Record<string, number> = { monthly: 62, quarterly: 150, annual: 550 };

function periodDate(period: string | null): number | null {
  if (!period) return null;
  const direct = Date.parse(period);
  if (Number.isFinite(direct)) return direct;
  const year = period.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return null;
  const quarter = period.match(/Q([1-4])/i)?.[1];
  const month = quarter ? (Number(quarter) - 1) * 3 : period.toLowerCase().includes("annual") ? 11 : 0;
  return Date.UTC(Number(year), month, 1);
}

export function assessDelivery(kpi: DeliveryKpi, now = new Date()): DeliveryAssessment {
  const required = [
    [kpi.ministry_id, "No accountable ministry"],
    [kpi.baseline, "No baseline value"],
    [kpi.baseline_period, "No baseline period"],
    [kpi.target_period, "No target date"],
    [kpi.target_basis, "No approved target basis"],
    [kpi.evidence_url, "No evidence reference"],
  ] as const;
  if (kpi.verification_status !== "qualified") {
    return { status: "unscored", expected: null, gapPct: null, reason: "Awaiting independent qualification", evidenceAgeDays: null };
  }
  const missing = required.find(([value]) => value == null || value === "");
  if (missing) return { status: "unscored", expected: null, gapPct: null, reason: missing[1], evidenceAgeDays: null };
  if (!kpi.latest || kpi.latest.value == null) {
    return { status: "unscored", expected: null, gapPct: null, reason: "No reported actual", evidenceAgeDays: null };
  }

  const ageDays = Math.floor((now.getTime() - Date.parse(kpi.latest.captured_at)) / 86_400_000);
  if (ageDays > (MAX_AGE_DAYS[kpi.cadence] ?? 550)) {
    return { status: "unscored", expected: null, gapPct: null, reason: "Reported actual is stale", evidenceAgeDays: ageDays };
  }

  const start = periodDate(kpi.baseline_period);
  const end = periodDate(kpi.target_period);
  if (start == null || end == null || end <= start || kpi.baseline == null) {
    return { status: "unscored", expected: null, gapPct: null, reason: "Baseline or target period cannot be interpreted", evidenceAgeDays: ageDays };
  }
  const actualAt = periodDate(kpi.latest.period) ?? Date.parse(kpi.latest.captured_at);
  const progress = Math.max(0, Math.min(1, (actualAt - start) / (end - start)));
  const expected = kpi.baseline + (kpi.target - kpi.baseline) * progress;
  const actual = kpi.latest.value;
  const direction = normalizeDirection(kpi.direction);
  const signedGap = direction === "down" ? actual - expected : direction === "flat" ? Math.abs(actual - expected) : expected - actual;
  const denominator = Math.max(Math.abs(expected), Math.abs(kpi.target - kpi.baseline), 0.000001);
  const gapPct = Math.max(0, (signedGap / denominator) * 100);
  const status: DeliveryStatus = gapPct <= kpi.warning_tolerance_pct ? "on" : gapPct <= kpi.critical_tolerance_pct ? "risk" : "off";
  return { status, expected, gapPct, reason: null, evidenceAgeDays: ageDays };
}

export function normalizeDirection(value: string | null | undefined): "up" | "down" | "flat" {
  const direction = (value ?? "up").toLowerCase();
  if (direction === "down" || direction.includes("lower")) return "down";
  if (direction === "flat" || direction.includes("stable")) return "flat";
  return "up";
}
