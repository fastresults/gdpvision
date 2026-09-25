// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.investments.tsx
//
// Rationales for the investment pipeline, project workspace and investor
// pages ("investments.*").
//
// standards-entries.ts still registers an older "investments.readiness".
// registerRationales() overwrites by key, so this file imports that module
// FIRST: ES modules evaluate once, in import order, which guarantees the
// entry below wins no matter which page loads first.

import "@/lib/explain/standards-entries";

import { registerRationales, type DerivedLine, type Rationale } from "@/lib/explain/registry";
import { STAGE_TO_OC4IDS_STATUS } from "@/lib/investments/oc4ids";
import type { ReadinessCheck } from "@/lib/investments/readiness";

export type ReadinessCtx = { checks: ReadinessCheck[] };
export type PipelineTotalsCtx = { count: number; capex: number; missingCapex: number };
export type StageTotalsCtx = {
  stage: string;
  count: number;
  amount: number;
  withoutAmount: number;
};
export type LinkStatsCtx = {
  views: number;
  visitors: number;
  maxViews: number | null;
  viewCount: number;
};

const usd = (n: number) =>
  n >= 1e9
    ? `US$${(n / 1e9).toFixed(2)} bn`
    : n >= 1e6
      ? `US$${(n / 1e6).toFixed(1)} m`
      : `US$${Math.round(n).toLocaleString("en-US")}`;

const entries: Array<Rationale<never>> = [
  {
    key: "investments.readiness",
    title: "How investment readiness is scored",
    short:
      "Investor-grade checks passed, out of ten. All ten must pass before a project can be submitted for approval.",
    formula:
      'One point per check: profile (sector, structure, capital cost, summary), revenue model, sponsor, beneficial owners disclosed, AML cleared, E&S category (A, B, C or FI), climate alignment, key risks, feasibility complete, land and permits secured. A text field counts only if it has at least three characters and is not a placeholder such as "TBD" or "n/a".',
    basis:
      "Each check maps to a named standard: OC4IDS, World Bank PPP Framework, FATF Recommendations 10 and 24, IFC Performance Standards, ISSB / EU Taxonomy and GI Hub project preparation guidance. The database applies the same ten checks and refuses a submission or approval below ten.",
    caveat:
      "Beneficial owners and AML are confirmed by a compliance officer in the restricted compliance record; everyone else sees only whether they pass. Passing is not an investment recommendation.",
    derive: ((ctx: ReadinessCtx | undefined): DerivedLine[] => {
      if (!ctx?.checks) return [];
      const passed = ctx.checks.filter((c) => c.ok).length;
      return [
        { label: "Passed", value: `${passed} of ${ctx.checks.length}` },
        ...ctx.checks
          .filter((c) => !c.ok)
          .map((c) => ({ label: c.label, value: "Not yet", note: c.fix })),
      ];
    }) as never,
  },
  {
    key: "investments.pipeline_capex",
    title: "Total capital cost in the pipeline",
    short: "Sum of the capital cost entered for every project shown, whatever its approval state.",
    formula:
      "Sum of capital cost (US$) across the projects listed. Projects with no capital cost entered add nothing.",
    basis: "Figures are as entered by the project team; they are not independently verified.",
    caveat:
      "Draft figures change as preparation advances. Use the approved total for anything shared outside government.",
    derive: ((ctx: PipelineTotalsCtx | undefined): DerivedLine[] =>
      ctx
        ? [
            { label: "Projects", value: String(ctx.count) },
            { label: "Total", value: usd(ctx.capex) },
            ...(ctx.missingCapex
              ? [{ label: "Without a capital cost", value: String(ctx.missingCapex) }]
              : []),
          ]
        : []) as never,
  },
  {
    key: "investments.approved_capex",
    title: "Approved for investors",
    short:
      "Projects a second person with an approver role has approved, and their total capital cost.",
    formula:
      'Count and summed capital cost of projects whose approval state is "Approved for investors".',
    basis:
      "Approval needs all ten readiness checks and a country admin, cabinet secretary or principal who did not submit the project. Only these projects can be shared or exported to OC4IDS.",
    caveat:
      "Editing an approved project sends it back to draft and pauses its share links until it is approved again.",
    derive: ((ctx: PipelineTotalsCtx | undefined): DerivedLine[] =>
      ctx
        ? [
            { label: "Approved projects", value: String(ctx.count) },
            { label: "Capital cost", value: usd(ctx.capex) },
          ]
        : []) as never,
  },
  {
    key: "investments.awaiting",
    title: "Awaiting approval",
    short:
      "Projects submitted at ten out of ten and waiting for a second person to approve or return them.",
    formula: 'Count of projects in the "Awaiting approval" state.',
    basis: "The person who submitted a project cannot approve it.",
  },
  {
    key: "investments.interest_by_stage",
    title: "Indicative amount by stage",
    short: "Sum of the indicative amounts recorded against each interest at this stage.",
    formula:
      "Sum of indicative amount (US$) for every interest at the stage. Interests without an amount are counted but add nothing.",
    basis:
      "Amounts are what investors have indicated to the team; they are not commitments until a term sheet is signed.",
    caveat:
      "One investor can appear under several projects, so totals across projects can double-count the same capital.",
    derive: ((ctx: StageTotalsCtx | undefined): DerivedLine[] =>
      ctx
        ? [
            { label: "Stage", value: ctx.stage },
            { label: "Interests", value: String(ctx.count) },
            { label: "Indicative total", value: usd(ctx.amount) },
            ...(ctx.withoutAmount
              ? [{ label: "Without an amount", value: String(ctx.withoutAmount) }]
              : []),
          ]
        : []) as never,
  },
  {
    key: "investments.link_views",
    title: "How share-link views are counted",
    short:
      "Every opening of the public page counts as a view; visitors are distinct network addresses.",
    formula:
      "Views: each time the page loads. Visitors: distinct hashes of the visitor's network address combined with the link, so the same person on another network counts twice.",
    basis: "No raw address is stored, only a one-way hash.",
    caveat:
      "Link previews in chat apps and email scanners can register views before a person opens the link.",
    derive: ((ctx: LinkStatsCtx | undefined): DerivedLine[] =>
      ctx
        ? [
            { label: "Views", value: String(ctx.views) },
            { label: "Distinct visitors", value: String(ctx.visitors) },
            ...(ctx.maxViews != null
              ? [{ label: "View limit", value: `${ctx.viewCount} of ${ctx.maxViews} used` }]
              : []),
          ]
        : []) as never,
  },
  {
    key: "investments.oc4ids",
    title: "How the OC4IDS export is built",
    short:
      "Approved projects only, in the Open Contracting for Infrastructure Data Standard 0.9 project package format.",
    formula: `Stage becomes OC4IDS status: ${Object.entries(STAGE_TO_OC4IDS_STATUS)
      .map(([k, v]) => `${k.replace("_", "-")} → ${v}`)
      .join(
        ", ",
      )}. Sector is matched to the projectSector codelist; E&S category becomes an impact category under the IFC scheme; capital cost becomes the budget in US$.`,
    basis:
      "Field names and codelists are checked against the OC4IDS 0.9 schema. The sponsor and all compliance data are left out.",
    caveat:
      "Project identifiers must start with a prefix registered with the Open Contracting Partnership. Until one is registered, the export uses a placeholder and should not be published.",
  },
];

registerRationales(entries);
