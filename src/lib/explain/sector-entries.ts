// @domain explain
// @tables none
// @ui src/components/sector/PlanVisualSummary.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<never>> = [
  {
    key: "sector.plan-readiness",
    title: "Plan readiness",
    short: "Five evidence and completeness checks determine whether this plan is ready for review.",
    formula:
      "20 points each: all sections drafted, all current, all cited, KPIs complete, projects complete.",
    basis: "The Sector Studio method and the deterministic Auditor checks on saved sections.",
    caveat:
      "Readiness means the document can be reviewed. It does not mean the proposed outcomes have been achieved.",
  },
  {
    key: "sector.target-trajectory",
    title: "Target trajectory",
    short:
      "The saved baseline and Year 3, 5 and 10 targets, normalized only for visual comparison.",
    formula: "Each line uses its own minimum and maximum; labels retain the exact plan wording.",
    basis: "The outcome-target table in the saved Ambition section.",
    caveat:
      "These are planned outcomes, not forecasts or recorded achievements. Missing baselines remain visibly unestablished.",
  },
  {
    key: "sector.delivery-portfolio",
    title: "Delivery portfolio",
    short: "Projects grouped by their stated strategy pillar, with unresolved rows separated.",
    formula:
      "Confirmed rows contain no ‘to be confirmed’ field; all other rows remain provisional.",
    basis: "The Entry Point Projects table in the saved plan.",
    caveat:
      "A project appearing here has been proposed by the plan; it is not evidence that delivery has started.",
  },
  {
    key: "sector.evidence-composition",
    title: "Evidence composition",
    short: "Sections are separated into grounded, needs confirmation and gap states.",
    formula:
      "Gap or blank section → gap; contains an explicit confirmation marker → needs confirmation; otherwise → grounded.",
    basis: "Saved section status, text, citations and Auditor findings.",
    caveat:
      "Grounded means the section has no explicit unresolved marker. Review the citations before relying on a claim.",
  },
];

registerRationales(entries);
