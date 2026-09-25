// @domain standards
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.standards.tsx
//
// Pure scoring for the standards audit. No I/O: the server function gathers
// requirements, figures, plans and mappings, and this file decides each
// requirement's status. The monthly snapshot hook calls the same function, so
// the page and the history can never disagree.
//
// The rules, in plain language (mirrored in src/lib/explain/standards-entries.ts):
//   collected  every mapped figure is present, published at least as often as
//              the standard requires, and no older than one reporting period
//              plus the allowed publication lag.
//   partial    some figures are present, or they are published less often than
//              the standard requires (a yearly figure cannot show monthly release).
//   stale      figures exist but the newest is older than period + allowed lag.
//   planned    no usable figure yet, but an approved collection plan exists.
//   missing    no figure and no approved plan.
// An approved plan never turns a gap into "collected": a plan is a promise,
// not evidence. It shows as "planned", or as "partial · plan approved".

export type ReqStatus = "collected" | "partial" | "stale" | "planned" | "missing";
export type Grain = "month" | "quarter" | "year";
export type Frequency = "monthly" | "quarterly" | "annual" | "continuous";

export const STATUS_ORDER: ReqStatus[] = ["missing", "stale", "planned", "partial", "collected"];
export const IMPACT_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
/** Credit each status earns toward the weighted index. */
export const STATUS_CREDIT: Record<ReqStatus, number> = {
  collected: 1,
  partial: 0.5,
  stale: 0.25,
  planned: 0,
  missing: 0,
};

export type ParsedPeriod = { grain: Grain; start: Date; end: Date };

const GRAIN_MONTHS: Record<Grain, number> = { month: 1, quarter: 3, year: 12 };
const FREQ_GRAIN: Record<Frequency, Grain | null> = {
  monthly: "month",
  quarterly: "quarter",
  annual: "year",
  continuous: null,
};

function endOfMonth(y: number, m0: number): Date {
  return new Date(Date.UTC(y, m0 + 1, 0, 23, 59, 59));
}

/**
 * Parse the period labels found in country_kpis / country_kpi_points:
 * "2024", "FY2024", "2024/25", "2024-Q3", "2024Q3", "Q3 2024", "2024-07",
 * "2024M07", "2024-07-15", "Jul 2024". Returns null for anything else.
 */
export function parsePeriod(raw: string | null | undefined): ParsedPeriod | null {
  if (!raw) return null;
  const p = raw.trim();
  let m: RegExpMatchArray | null;

  if (
    (m = p.match(/^((?:19|20)\d{2})\s*[-_ ]?\s*Q([1-4])$/i)) ||
    (m = p.match(/^Q([1-4])\s*[-_ ]?\s*((?:19|20)\d{2})$/i))
  ) {
    const [y, q] = /^Q/i.test(p) ? [Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2])];
    const m0 = (q - 1) * 3;
    return { grain: "quarter", start: new Date(Date.UTC(y, m0, 1)), end: endOfMonth(y, m0 + 2) };
  }
  if ((m = p.match(/^((?:19|20)\d{2})[-_/M]?(0[1-9]|1[0-2])(?:[-/](\d{2}))?$/i))) {
    const y = Number(m[1]);
    const m0 = Number(m[2]) - 1;
    return { grain: "month", start: new Date(Date.UTC(y, m0, 1)), end: endOfMonth(y, m0) };
  }
  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  if ((m = p.match(/^([A-Za-z]{3})[a-z]*\.?\s+((?:19|20)\d{2})$/))) {
    const m0 = MONTHS.indexOf(m[1].toLowerCase());
    if (m0 >= 0) {
      const y = Number(m[2]);
      return { grain: "month", start: new Date(Date.UTC(y, m0, 1)), end: endOfMonth(y, m0) };
    }
  }
  // Fiscal year spanning two calendar years: "2024/25", "FY2024/25", "2024-2025".
  if ((m = p.match(/^(?:FY\s*)?((?:19|20)\d{2})\s*[/-]\s*((?:19|20)?\d{2})$/i))) {
    const y1 = Number(m[1]);
    const y2 = m[2].length === 2 ? Math.floor(y1 / 100) * 100 + Number(m[2]) : Number(m[2]);
    if (y2 === y1 + 1) {
      // Most Eastern Caribbean fiscal years are calendar years; where they are not,
      // treat the period as ending mid-way through the second year.
      return { grain: "year", start: new Date(Date.UTC(y1, 6, 1)), end: endOfMonth(y2, 5) };
    }
  }
  if ((m = p.match(/^(?:FY\s*)?((?:19|20)\d{2})$/i))) {
    const y = Number(m[1]);
    return { grain: "year", start: new Date(Date.UTC(y, 0, 1)), end: endOfMonth(y, 11) };
  }
  return null;
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Finest grain among the given periods, or null if none parse. */
export function finestGrain(periods: Array<string | null | undefined>): Grain | null {
  let best: Grain | null = null;
  for (const raw of periods) {
    const g = parsePeriod(raw)?.grain;
    if (!g) continue;
    if (!best || GRAIN_MONTHS[g] < GRAIN_MONTHS[best]) best = g;
  }
  return best;
}

export type FigureInput = {
  kpiCode: string;
  label: string | null;
  latestValue: number | null;
  latestPeriod: string | null;
  sourceUrl: string | null;
  /** Recent point periods (any order), used to detect how often the figure is published. */
  pointPeriods: string[];
};

export type RequirementInput = {
  id: string;
  standardCode: string;
  reqKey: string;
  label: string;
  clause: string | null;
  frequency: string;
  maxLagMonths: number;
  impact: string;
  /** Curated mapping from the standards library. */
  kpiCodes: string[];
};

export type PlanInput = {
  id: string;
  requirementId: string;
  status: string;
  ownerAgency: string | null;
  dueDate: string | null;
  version: number;
};

export type MappingInput = { requirementId: string; kpiCode: string; status: string };

export type Evidence = {
  kpi: string;
  label: string | null;
  period: string | null;
  source: string | null;
  grain: Grain | null;
  ageMonths: number | null;
  fresh: boolean;
  viaMapping: boolean;
};

export type AuditRow = {
  id: string;
  standardCode: string;
  reqKey: string;
  label: string;
  clause: string | null;
  frequency: string;
  maxLagMonths: number;
  impact: string;
  status: ReqStatus;
  /** Plain-language reasons, in the order they were decided. Shown in the Explain panel. */
  reasons: string[];
  expectedKpis: string[];
  evidence: Evidence[];
  frequencyMet: boolean | null;
  plan: (PlanInput & { overdue: boolean }) | null;
};

export type AuditSummary = {
  total: number;
  counts: Record<ReqStatus, number>;
  coveragePct: number;
  weightedPct: number;
  byStandard: Array<{ code: string; met: number; total: number; weightedPct: number }>;
};

function grainLabel(g: Grain | null): string {
  return g === "month"
    ? "monthly"
    : g === "quarter"
      ? "quarterly"
      : g === "year"
        ? "yearly"
        : "irregularly";
}

export function scoreRequirement(
  req: RequirementInput,
  figures: Map<string, FigureInput>,
  plan: PlanInput | null,
  mappings: MappingInput[],
  now: Date,
): AuditRow {
  const accepted = mappings
    .filter((m) => m.requirementId === req.id && m.status === "accepted")
    .map((m) => m.kpiCode);
  const expected = Array.from(new Set([...req.kpiCodes, ...accepted]));
  const reasons: string[] = [];
  const freq = (
    ["monthly", "quarterly", "annual", "continuous"].includes(req.frequency)
      ? req.frequency
      : "annual"
  ) as Frequency;
  const requiredGrain = FREQ_GRAIN[freq];

  const evidence: Evidence[] = [];
  for (const code of expected) {
    const f = figures.get(code);
    if (!f || f.latestValue == null) continue;
    const latest = parsePeriod(f.latestPeriod);
    const grain = finestGrain([f.latestPeriod, ...f.pointPeriods]);
    const ageMonths = latest ? Math.max(0, monthsBetween(latest.end, now)) : null;
    // Allowed age: one period at the required grain (or the figure's own grain if
    // it is coarser) plus the standard's publication lag.
    const periodMonths = GRAIN_MONTHS[grain ?? "year"];
    const allowed =
      req.maxLagMonths + Math.max(periodMonths, requiredGrain ? GRAIN_MONTHS[requiredGrain] : 0);
    evidence.push({
      kpi: code,
      label: f.label,
      period: f.latestPeriod,
      source: f.sourceUrl,
      grain,
      ageMonths,
      fresh: ageMonths != null && ageMonths <= allowed,
      viaMapping: !req.kpiCodes.includes(code),
    });
  }

  const overdue =
    !!plan &&
    plan.status === "approved" &&
    !!plan.dueDate &&
    new Date(`${plan.dueDate}T23:59:59Z`) < now;
  const planOut = plan ? { ...plan, overdue } : null;
  const planApproved = plan?.status === "approved";

  let frequencyMet: boolean | null = null;
  let status: ReqStatus;

  if (evidence.length === 0) {
    if (expected.length === 0) {
      reasons.push("No figure in the platform maps to this requirement yet.");
    } else {
      reasons.push(
        `None of the expected figures (${expected.join(", ")}) has a value for this country.`,
      );
    }
    if (planApproved) {
      status = "planned";
      reasons.push(
        overdue
          ? `An approved collection plan exists, but its due date (${plan!.dueDate}) has passed with no evidence.`
          : "An approved collection plan exists. It counts as planned, not collected, until evidence arrives.",
      );
    } else {
      status = "missing";
      if (plan) reasons.push(`A collection plan is ${plan.status}; it counts once approved.`);
    }
  } else {
    const freshCount = evidence.filter((e) => e.fresh).length;
    if (freshCount === 0) {
      status = "stale";
      const newest = evidence.reduce((a, b) =>
        (a.ageMonths ?? 1e9) <= (b.ageMonths ?? 1e9) ? a : b,
      );
      reasons.push(
        `Newest reading is ${newest.period ?? "undated"}${newest.ageMonths != null ? `, ${newest.ageMonths} months old` : ""}; ` +
          `the standard allows ${req.maxLagMonths} months after the period closes.`,
      );
    } else {
      const observed = evidence.map((e) => e.grain);
      frequencyMet =
        requiredGrain == null
          ? true
          : observed.some((g) => g != null && GRAIN_MONTHS[g] <= GRAIN_MONTHS[requiredGrain]);
      const incomplete = evidence.length < expected.length;
      if (!frequencyMet) {
        status = "partial";
        const finest = finestGrain(evidence.map((e) => e.period));
        reasons.push(`Published ${grainLabel(finest)}; the standard requires ${freq} release.`);
      } else if (incomplete) {
        status = "partial";
        const have = new Set(evidence.map((e) => e.kpi));
        reasons.push(`Missing: ${expected.filter((c) => !have.has(c)).join(", ")}.`);
      } else if (freshCount < evidence.length) {
        status = "partial";
        reasons.push(
          `${evidence.length - freshCount} of ${evidence.length} figures are out of date.`,
        );
      } else {
        status = "collected";
        reasons.push("Every expected figure is present, current and published often enough.");
      }
      if (status === "partial" && planApproved)
        reasons.push("An approved collection plan covers the remainder.");
    }
  }

  return {
    id: req.id,
    standardCode: req.standardCode,
    reqKey: req.reqKey,
    label: req.label,
    clause: req.clause,
    frequency: req.frequency,
    maxLagMonths: req.maxLagMonths,
    impact: req.impact,
    status,
    reasons,
    expectedKpis: expected,
    evidence,
    frequencyMet,
    plan: planOut,
  };
}

export function summarise(rows: AuditRow[], standardCodes: string[]): AuditSummary {
  const counts: Record<ReqStatus, number> = {
    collected: 0,
    partial: 0,
    stale: 0,
    planned: 0,
    missing: 0,
  };
  for (const r of rows) counts[r.status]++;
  const weighted = (rs: AuditRow[]) => {
    const w = rs.reduce((s, r) => s + (IMPACT_WEIGHT[r.impact] ?? 1), 0);
    const got = rs.reduce(
      (s, r) => s + (IMPACT_WEIGHT[r.impact] ?? 1) * STATUS_CREDIT[r.status],
      0,
    );
    return w ? Math.round((got / w) * 1000) / 10 : 0;
  };
  return {
    total: rows.length,
    counts,
    coveragePct: rows.length ? Math.round((counts.collected / rows.length) * 1000) / 10 : 0,
    weightedPct: weighted(rows),
    byStandard: standardCodes.map((code) => {
      const mine = rows.filter((r) => r.standardCode === code);
      return {
        code,
        met: mine.filter((r) => r.status === "collected").length,
        total: mine.length,
        weightedPct: weighted(mine),
      };
    }),
  };
}

export function computeAudit(input: {
  requirements: RequirementInput[];
  figures: FigureInput[];
  plans: PlanInput[];
  mappings: MappingInput[];
  standardCodes: string[];
  now?: Date;
}): { rows: AuditRow[]; summary: AuditSummary } {
  const now = input.now ?? new Date();
  const figures = new Map(input.figures.map((f) => [f.kpiCode, f]));
  const plans = new Map(input.plans.map((p) => [p.requirementId, p]));
  const rows = input.requirements.map((r) =>
    scoreRequirement(r, figures, plans.get(r.id) ?? null, input.mappings, now),
  );
  return { rows, summary: summarise(rows, input.standardCodes) };
}

/** Gap ordering: impact first, then how far from collected, then label. */
export function gapOrder(a: AuditRow, b: AuditRow): number {
  const ia = IMPACT_WEIGHT[a.impact] ?? 0;
  const ib = IMPACT_WEIGHT[b.impact] ?? 0;
  if (ia !== ib) return ib - ia;
  const sa = STATUS_ORDER.indexOf(a.status);
  const sb = STATUS_ORDER.indexOf(b.status);
  if (sa !== sb) return sa - sb;
  return a.label.localeCompare(b.label);
}
