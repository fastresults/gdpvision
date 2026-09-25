// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.standards.tsx
//
// Rationales for the standards audit ("standards.*") and the investment
// pipeline ("investments.*"). The scoring rules are stated at the top of
// src/lib/standards/scoring.ts; the wording here mirrors them and must change
// with them.
//
// Context shapes passed by the standards page (all optional; every derive
// tolerates a missing context and returns no lines):
//   standards.coverage   StandardsSummaryCtx
//   standards.weighted   StandardsSummaryCtx
//   standards.status     StandardsRowCtx
//   standards.freshness  StandardsRowCtx
//   standards.planned    StandardsRowCtx
//   standards.mapping    StandardsMappingCtx

import { registerRationales, type DerivedLine, type Rationale } from "@/lib/explain/registry";
import { IMPACT_WEIGHT, STATUS_CREDIT, type ReqStatus } from "@/lib/standards/scoring";

export type StandardsSummaryCtx = {
  total: number;
  counts: Record<ReqStatus, number>;
  coveragePct: number;
  weightedPct: number;
  /** One entry per requirement, for the weighted arithmetic. */
  rows: Array<{ impact: string; status: ReqStatus }>;
};

export type StandardsRowCtx = {
  label: string;
  status: ReqStatus;
  frequency: string;
  maxLagMonths: number;
  reasons: string[];
  evidence: Array<{
    kpi: string;
    period: string | null;
    ageMonths: number | null;
    fresh: boolean;
    viaMapping: boolean;
  }>;
  plan: { status: string; dueDate: string | null; overdue: boolean } | null;
};

export type StandardsMappingCtx = {
  kpiCode: string;
  kpiLabel: string | null;
  confidence: number | null;
  rationale: string | null;
  status: string;
};

const STATUS_WORD: Record<ReqStatus, string> = {
  collected: "Collected",
  partial: "Partial",
  stale: "Out of date",
  planned: "Planned",
  missing: "Missing",
};

const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
  continuous: 0,
};

const summaryEntries: Array<Rationale<StandardsSummaryCtx>> = [
  {
    key: "standards.coverage",
    title: "How coverage is counted",
    short:
      "The share of requirements whose status is Collected. Partial, out-of-date and planned items do not count.",
    formula:
      "Coverage = requirements with status Collected ÷ all requirements in the library, as a percentage.",
    basis:
      "A requirement is Collected when every figure mapped to it is present, published at least as often as the standard requires, and no older than one reporting period plus the standard's allowed publication lag. Requirements come from the curated standards library (IMF e-GDDS/SDDS, GFSM 2014, BPM6, SNA, SDG, SPI, FATF, PEFA).",
    caveat:
      "Coverage is strict on purpose. An approved collection plan never makes a requirement Collected: a plan is a promise, not evidence. See the weighted index for partial credit.",
    derive: (ctx) =>
      ctx
        ? [
            { label: "Requirements collected", value: String(ctx.counts.collected) },
            { label: "Requirements in the library", value: String(ctx.total) },
            { label: "Coverage", value: `${ctx.coveragePct.toFixed(1)}%` },
          ]
        : [],
  },
  {
    key: "standards.weighted",
    title: "How the impact-weighted index is scored",
    short:
      "Each requirement earns credit by status, weighted by its impact. High-impact gaps pull the index down most.",
    formula:
      "Index = Σ (impact weight × status credit) ÷ Σ impact weight. Impact weight: high 3, medium 2, low 1. Credit: Collected 1, Partial 0.5, Out of date 0.25, Planned 0, Missing 0.",
    basis:
      "Impact reflects how much the requirement matters to rating agencies, lenders and peer reviews (curated in the standards library). Partial and out-of-date figures earn some credit because the collection exists and needs finishing or refreshing, not starting.",
    caveat:
      "A planned item earns nothing until evidence arrives. Accepting an AI-suggested mapping can raise the index, which is why only an approver can accept one.",
    derive: (ctx) => {
      if (!ctx) return [];
      let possible = 0;
      let earned = 0;
      for (const r of ctx.rows) {
        const w = IMPACT_WEIGHT[r.impact] ?? 1;
        possible += w;
        earned += w * STATUS_CREDIT[r.status];
      }
      const lines: DerivedLine[] = (Object.keys(STATUS_CREDIT) as ReqStatus[]).map((s) => {
        const w = ctx.rows
          .filter((r) => r.status === s)
          .reduce((a, r) => a + (IMPACT_WEIGHT[r.impact] ?? 1), 0);
        return {
          label: `${STATUS_WORD[s]} · ${ctx.counts[s]} requirement${ctx.counts[s] === 1 ? "" : "s"}`,
          value: `${w} × ${STATUS_CREDIT[s]} = ${(w * STATUS_CREDIT[s]).toFixed(2)}`,
          note: "Summed impact weight × credit for this status",
        };
      });
      lines.push({
        label: "Credit earned ÷ weight possible",
        value: `${earned.toFixed(2)} ÷ ${possible}`,
      });
      lines.push({ label: "Index", value: `${ctx.weightedPct.toFixed(1)}%` });
      return lines;
    },
  },
  {
    key: "standards.executive-perspective",
    title: "How the executive perspective is formed",
    short:
      "A deterministic reading of the selected audit measure, its direction, high-impact exposure and decision relevance.",
    formula:
      "Current scores and status counts come directly from the audit. Direction compares the live weighted index with the latest earlier monthly snapshot. Priority exposure counts high-impact requirements below Collected.",
    basis:
      "The perspective uses only the loaded audit, monthly snapshots and the published scoring rules. It is not generated by AI.",
    caveat:
      "No direction is inferred without an earlier monthly snapshot. Scores assess evidence availability and timeliness, not policy performance.",
  },
];

const rowEntries: Array<Rationale<StandardsRowCtx>> = [
  {
    key: "standards.status",
    title: "Why this requirement has its status",
    short:
      "Collected, Partial, Out of date, Planned or Missing — decided from the figures, how often they are published, and how recent they are.",
    formula:
      "Collected: every mapped figure present, published at least as often as required, and no older than one period plus the allowed lag. Partial: some figures present, or published less often than required. Out of date: figures exist but the newest is older than period plus lag. Planned: no usable figure, but an approved collection plan. Missing: no figure and no approved plan.",
    basis:
      "The reasons below are the ones the scoring recorded for this requirement, in the order it decided them.",
    caveat:
      "A yearly figure cannot show monthly or quarterly release, so a monthly requirement met only by yearly data stays Partial however recent the figure is.",
    derive: (ctx) => {
      if (!ctx) return [];
      const lines: DerivedLine[] = [
        { label: "Status", value: STATUS_WORD[ctx.status] ?? ctx.status },
      ];
      ctx.reasons.forEach((r, i) => lines.push({ label: r, value: `Reason ${i + 1}` }));
      for (const e of ctx.evidence) {
        lines.push({
          label: `${e.kpi}${e.viaMapping ? " (via AI mapping)" : ""}`,
          value: `${e.period ?? "undated"}${e.ageMonths != null ? ` · ${e.ageMonths} mo` : ""}`,
          note: e.fresh ? "Within the allowed age" : "Older than the allowed age",
        });
      }
      if (ctx.plan) {
        lines.push({
          label: "Collection plan",
          value: ctx.plan.status,
          note: ctx.plan.dueDate
            ? `Due ${ctx.plan.dueDate}${ctx.plan.overdue ? " — overdue" : ""}`
            : undefined,
        });
      }
      return lines;
    },
  },
  {
    key: "standards.freshness",
    title: "When a figure counts as current",
    short:
      "A figure is current if its period ended no more than one reporting period plus the standard's allowed lag ago.",
    formula:
      "Age = whole months from the end of the figure's latest period to today. Allowed age = the standard's publication lag + one period (1 month for monthly, 3 for quarterly, 12 for annual; the figure's own period if it is coarser). Current when age ≤ allowed age.",
    basis:
      "Periods are read from the figure's label: 2024, FY2024, 2024/25 (fiscal year ending June 2025), 2024-Q3, 2024-07, Jul 2024. How often a figure is published is read from its recent history, not only its latest reading.",
    caveat:
      'A label that cannot be read as a period (for example "latest") has no age and never counts as current.',
    derive: (ctx) => {
      if (!ctx) return [];
      const period = PERIOD_MONTHS[ctx.frequency] ?? 12;
      const lines: DerivedLine[] = [
        { label: "Required frequency", value: ctx.frequency },
        { label: "Allowed publication lag", value: `${ctx.maxLagMonths} months` },
        {
          label: "Allowed age at the required frequency",
          value: `${ctx.maxLagMonths + period} months`,
          note: "Longer if the figure itself is published less often",
        },
      ];
      for (const e of ctx.evidence) {
        lines.push({
          label: `${e.kpi} · ${e.period ?? "undated"}`,
          value: e.ageMonths != null ? `${e.ageMonths} months old` : "age unknown",
          note: e.fresh ? "Current" : "Out of date",
        });
      }
      return lines;
    },
  },
  {
    key: "standards.planned",
    title: 'Why an approved plan is not "collected"',
    short:
      "A plan is a promise, not evidence. The requirement counts as collected only when figures arrive.",
    formula:
      "No usable figure + approved plan = Planned (0 credit). Some figures + approved plan = Partial, noting the plan covers the rest. A plan that is still a draft, submitted or returned does not change the status.",
    basis:
      "Reviewers such as the IMF, FATF and PEFA assess what is published, not what is intended. Counting plans as coverage would overstate readiness.",
    caveat:
      "Once the approved plan's due date passes with no evidence, the plan is shown as overdue.",
    derive: (ctx) =>
      ctx?.plan
        ? [
            { label: "Plan status", value: ctx.plan.status },
            {
              label: "Due",
              value: ctx.plan.dueDate ?? "not set",
              note: ctx.plan.overdue ? "Overdue: the date has passed with no evidence" : undefined,
            },
          ]
        : [],
  },
];

const mappingEntries: Array<Rationale<StandardsMappingCtx>> = [
  {
    key: "standards.mapping",
    title: "AI-suggested mappings",
    short:
      "The model proposes figures the country already holds that may measure a requirement. Nothing counts until an approver accepts it.",
    formula:
      "The model sees only the requirements that are Missing or Partial and this country's own figure catalog. Every suggestion is checked: the figure must exist in the catalog, and pairs already mapped (by the library or an earlier suggestion) are skipped.",
    basis:
      'Confidence (0–100%) is the model\'s own estimate that the figure satisfies the requirement; the rationale names why. Once accepted, the figure is scored exactly like a curated one and is marked "via AI mapping" in the evidence.',
    caveat:
      "Accepting a mapping changes the audit score, so only a person who can approve collection plans can accept or reject one. Rejected suggestions are kept so they are not proposed again.",
    derive: (ctx) =>
      ctx
        ? [
            { label: "Figure", value: ctx.kpiCode, note: ctx.kpiLabel ?? undefined },
            {
              label: "Model confidence",
              value: ctx.confidence == null ? "not given" : `${Math.round(ctx.confidence * 100)}%`,
            },
            { label: ctx.rationale ?? "No rationale given", value: "Rationale" },
            { label: "Decision", value: ctx.status },
          ]
        : [],
  },
];

const investmentEntries: Array<Rationale<never>> = [
  {
    key: "investments.readiness",
    title: "How investment readiness is scored",
    short: "Number of investor-grade checks passed out of ten.",
    formula:
      "Each check maps to a named standard (OC4IDS, World Bank PPP Framework, FATF, IFC Performance Standards, ISSB/EU Taxonomy, GI Hub). All ten must pass before a project can be approved for syndication.",
    basis: "Checks read only the fields entered for the project; no values are inferred.",
    caveat:
      "Passing the checklist is not an investment recommendation; it confirms the package is complete enough for investor due diligence.",
  },
];

registerRationales([
  ...(summaryEntries as Array<Rationale<never>>),
  ...(rowEntries as Array<Rationale<never>>),
  ...(mappingEntries as Array<Rationale<never>>),
  ...investmentEntries,
]);
