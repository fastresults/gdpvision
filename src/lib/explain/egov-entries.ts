// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.egov_.$prdId.tsx
//
// Rationales for the Digital Government Studio ("egov.*"). The stage order
// and briefs are in src/lib/egov/stages.ts; the brand rules and contrast
// arithmetic in src/lib/egov/brand.ts. The wording here mirrors them.
//
// Context shapes (all optional; every derive tolerates a missing context):
//   egov.section.grounding  { contextLines, citations, status, model }
//   egov.section.stale      { authoredAt }
//   egov.brand.contrast     { role, hex, ratio }
//   egov.prd.progress       { drafted, total, gaps, stale }

import { registerRationales, type DerivedLine, type Rationale } from "@/lib/explain/registry";

type GroundingCtx = {
  contextLines?: number;
  citations?: number;
  status?: string;
  model?: string | null;
};
type StaleCtx = { authoredAt?: string | null };
type ContrastCtx = { role?: string; hex?: string; ratio?: number };
type ProgressCtx = { drafted?: number; total?: number; gaps?: number; stale?: number };

const entries: Array<Rationale<never>> = [
  {
    key: "egov.section.grounding",
    title: "How this section was written",
    short: "Drafted from the country's own corpus lines; every claim it relied on is cited below.",
    formula:
      "Context pack (corpus rows for this stage, plus the PRD scope) → one model call → section text + the context keys it relied on.",
    basis:
      "The model sees only the context pack. A section with no usable citations is recorded as a gap, not filled in.",
    caveat:
      "A human edit replaces the drafted text; the citations then describe the draft it started from.",
    derive: (ctx: GroundingCtx): DerivedLine[] =>
      ctx
        ? [
            { label: "Context lines shown to the model", value: String(ctx.contextLines ?? "—") },
            { label: "Lines cited", value: String(ctx.citations ?? "—") },
            { label: "Status", value: ctx.status ?? "—" },
            { label: "Model", value: ctx.model ?? "—" },
          ]
        : [],
  } as Rationale<never>,
  {
    key: "egov.section.stale",
    title: "Why this section is out of date",
    short: "The corpus rows this section was written from have changed since it was drafted.",
    formula: "Hash of the corpus lines at drafting ≠ hash of the same lines now.",
    basis:
      "Only corpus lines are hashed; editing the PRD scope does not mark sections out of date.",
    caveat:
      "Refreshing re-runs the stage and keeps the previous text in a snapshot for comparison.",
    derive: (ctx: StaleCtx): DerivedLine[] =>
      ctx?.authoredAt ? [{ label: "Drafted", value: ctx.authoredAt.slice(0, 10) }] : [],
  } as Rationale<never>,
  {
    key: "egov.brand.contrast",
    title: "Contrast check",
    short: "WCAG 2.1 contrast ratio of the colour against the paper surface.",
    formula: "(L_lighter + 0.05) / (L_darker + 0.05), where L is relative luminance.",
    basis:
      "AA needs 4.5:1 for body text and 3:1 for large type. The accent and border colours are not used for text.",
    caveat:
      "Ratios are computed from the published flag values; a country may supply its own brand colours.",
    derive: (ctx: ContrastCtx): DerivedLine[] =>
      ctx && typeof ctx.ratio === "number"
        ? [
            { label: ctx.role ?? "Colour", value: ctx.hex ?? "—" },
            {
              label: "Ratio",
              value: `${ctx.ratio}:1`,
              note:
                ctx.ratio >= 4.5
                  ? "Meets AA for text"
                  : ctx.ratio >= 3
                    ? "Large type only"
                    : "Not for text",
            },
          ]
        : [],
  } as Rationale<never>,
  {
    key: "egov.prd.progress",
    title: "PRD progress",
    short: "Sections drafted out of ten, with gaps and out-of-date sections counted separately.",
    formula:
      "drafted = sections whose status is not pending; gaps and stale are subsets of drafted.",
    basis:
      "A PRD can be submitted once every section is drafted; it can be approved once none is out of date.",
    derive: (ctx: ProgressCtx): DerivedLine[] =>
      ctx
        ? [
            { label: "Drafted", value: `${ctx.drafted ?? 0} of ${ctx.total ?? 10}` },
            { label: "Gaps", value: String(ctx.gaps ?? 0) },
            { label: "Out of date", value: String(ctx.stale ?? 0) },
          ]
        : [],
  } as Rationale<never>,
  {
    key: "egov.stage.order",
    title: "Why sections are drafted in this order",
    short:
      "Later sections read earlier ones, so the architecture follows the services and the roadmap follows the architecture.",
    basis:
      "Each stage lists the stages it builds on (src/lib/egov/stages.ts); a section cannot be drafted before those.",
  } as Rationale<never>,
];

registerRationales(entries);
