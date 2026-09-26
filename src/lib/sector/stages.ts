// Canonical stage list for the Sector Studio (chamber 10). Import from any UI
// that renders or counts plan progress; do not redefine locally. Each stage
// writes exactly one section of a Sector Development Plan, in this order.
//
// The method behind the briefs — five layers (Head of Government, minister,
// Sector Council, implementation plan, national sensitisation) and the seven
// ingredients shared by nations that grew a sector — is in
// docs/prd/sector-studio-framework.md and the project doc "Chamber 10 — Sector
// Development".

export type SectorStage =
  | "diagnostic"
  | "ambition"
  | "pillars"
  | "projects"
  | "enablers"
  | "measurement"
  | "compact"
  | "council"
  | "sensitisation"
  | "roadmap";

/** The agent role the orchestrator plays when drafting the stage. */
export type SectorAgent =
  "diagnostician" | "strategist" | "planner" | "economist" | "measurer" | "drafter";

export interface SectorStageMeta {
  key: SectorStage;
  ordinal: number;
  label: string;
  short: string;
  heading: string;
  desc: string;
  agent: SectorAgent;
  /** What the model is asked to write for this section. */
  brief: string;
  /** Sections that must be drafted before this one runs. */
  after: SectorStage[];
}

export const SECTOR_STAGES: SectorStageMeta[] = [
  {
    key: "diagnostic",
    ordinal: 1,
    label: "1. Diagnostic",
    short: "Diagnostic",
    heading: "Diagnostic: where the sector stands and what binds it",
    desc: "Size, structure, value chain, peers, and the binding constraint.",
    agent: "diagnostician",
    brief:
      "Diagnose the sector as it stands in this country. Cover: its size and share of the economy; its structure (who the firms are, how concentrated, how much is foreign-owned where the context says so); its position in the value chain; its links to other sectors; its exposure to external shocks; and the enablers it depends on (energy, connectivity, logistics, land, skills, finance, regulation). Then name the single binding constraint — the one thing that, if removed, would unlock the most growth — and give the evidence for it and your confidence (high, medium or low). Close with a short table of what the corpus could not tell you and the research that would close each gap (firm census, cost audit, investor soundings, peer benchmark).",
    after: [],
  },
  {
    key: "ambition",
    ordinal: 2,
    label: "2. Ambition and choice",
    short: "Ambition",
    heading: "Ambition and choice: what the sector will become",
    desc: "Sector thesis, targets at 3, 5 and 10 years, segments in and out, exit rule.",
    agent: "strategist",
    brief:
      "Write the sector thesis: one paragraph on what this sector will become in this country and why it can win, grounded in the diagnostic. Then set three outcome targets (for example output or value added, exports, jobs, private investment, average wage) with a baseline from the context, and a direction and range at year 3, year 5 and year 10. A target without a baseline in the context must say 'baseline to be established' and name the source that would supply it. Then state which segments are in and which are deliberately out, and write the exit rule: the conditions under which the Head of Government would retire this sector as a priority. Keep the choice narrow — few things done well.",
    after: ["diagnostic"],
  },
  {
    key: "pillars",
    ordinal: 3,
    label: "3. Strategy pillars",
    short: "Pillars",
    heading: "Strategy pillars",
    desc: "Five to seven things that must change, each with an owner.",
    agent: "strategist",
    brief:
      "Set out five to seven strategy pillars — the things that must change for the targets to be met. Consider market access and trade, skills and talent (including the diaspora), finance for firms, infrastructure and enablers, regulation and the ease of doing business, innovation and quality standards, and resilience. For each pillar: what changes, why it matters to the targets, the ministry or agency that owns it (from the context), and the first move. Every pillar carries a resilience line: what it does when a hurricane, a price shock or a pandemic hits.",
    after: ["ambition"],
  },
  {
    key: "projects",
    ordinal: 4,
    label: "4. Entry Point Projects",
    short: "Projects",
    heading: "Entry Point Projects",
    desc: "Eight to twenty projects with owner, funder, dates and a KPI; one flagship.",
    agent: "planner",
    brief:
      "Propose eight to twenty Entry Point Projects that deliver the pillars. Present them as a table with columns: project, pillar, owner (ministry, agency or firm type from the context), funding source (public, private, blended, donor — say 'to be confirmed' where unknown), first milestone, completion, and the KPI it moves. Where an approved investment project in the context fits, use it and say so. Name one flagship project and say why it is the flagship. Then list what the sector lab (a four-to-eight-week working session with industry and government) must confirm before each project is chartered.",
    after: ["pillars"],
  },
  {
    key: "enablers",
    ordinal: 5,
    label: "5. Enablers and policy",
    short: "Enablers",
    heading: "Enablers, policy and incentives",
    desc: "What government must change so the projects can happen.",
    agent: "economist",
    brief:
      "Set out what government must change so the projects can happen: laws and regulations to draft or amend, permits and procedures to simplify, institutions to set up or re-mandate (the promotion agency, the Sector Council, the delivery function), and incentives. Every incentive must carry conditions (exports, jobs, wages, local linkages) and a sunset date, and must name what it costs or say 'cost to be confirmed'. Present a policy calendar as a table: measure, owner, instrument (bill, regulation, Cabinet decision, administrative), and the quarter it is needed by.",
    after: ["projects"],
  },
  {
    key: "measurement",
    ordinal: 6,
    label: "6. Measurement and review",
    short: "Measurement",
    heading: "Scorecard, review rhythm and triggers",
    desc: "Outcome, delivery and enabler KPIs, each with baseline, source and owner.",
    agent: "measurer",
    brief:
      "Define the sector scorecard in three tiers: outcome KPIs (the targets), delivery KPIs (projects on time, decisions closed, blockers aged), and enabler KPIs (skills places filled, permits turned round, investment leads). Present it as a table with columns: KPI, tier, baseline (from the context, or 'to be established'), source, owner, reporting frequency. A KPI with no baseline goes on a separate data-collection list with the standard and body that would supply it — never on the scorecard as if it were known. Then set the review rhythm (weekly delivery meeting, monthly Sector Council, quarterly Head of Government stocktake, annual public report) and the triggers: what happens when a KPI is red for two quarters, and when a project misses two milestones (retire or rescue).",
    after: ["ambition", "projects"],
  },
  {
    key: "compact",
    ordinal: 7,
    label: "7. Sector Compact",
    short: "Compact",
    heading: "Sector Compact",
    desc: "One page: Head of Government and minister, three targets, flagship, conditions.",
    agent: "drafter",
    brief:
      "Draft the Sector Compact: a one-page agreement between the Head of Government and the minister who owns the sector. It states the three outcome targets (exactly as in the ambition section), the flagship project, the funding envelope (or 'to be confirmed'), the conditions attached to public support, the review dates (quarterly stocktakes and the annual report), and what each party commits to — the minister to deliver and report, the Head of Government to review, unblock and defend the budget. Leave signature lines for both, by role not by name unless the context names them. Keep it to one page.",
    after: ["ambition", "projects", "measurement"],
  },
  {
    key: "council",
    ordinal: 8,
    label: "8. Sector Council charter",
    short: "Council",
    heading: "Sector Council charter",
    desc: "Seats, mandate, working groups, rhythm and guardrails.",
    agent: "drafter",
    brief:
      "Draft the charter of the Sector Council, the standing public-private body that runs the plan between stocktakes. Give its 12 to 16 seats by role (the minister as chair, an industry deputy chair appointed by the Head of Government, five or six firm leaders across the value chain including an SME and a new entrant, labour, education and training, the investment and export agency, finance, the relevant regulator or utility, the diaspora or civil society, and the delivery lead as non-voting secretary), naming bodies from the context where it supports them. Then its mandate, quorum, term (three years, staggered), three to five working groups each with a 90-day first workplan, the monthly meeting rhythm, and the guardrails: published conflicts of interest, abstention when a member's firm stands to benefit, and an annual independent review of the scorecard's data.",
    after: ["pillars"],
  },
  {
    key: "sensitisation",
    ordinal: 9,
    label: "9. National sensitisation",
    short: "Sensitisation",
    heading: "National sensitisation plan",
    desc: "The sector narrative, four audiences, the calendar and the skills pipeline.",
    agent: "drafter",
    brief:
      "Write the national sensitisation plan. Start with the sector narrative: one short paragraph in the national voice on why this sector, what it will mean for a family in ten years, and the three numbers everyone should know (from the ambition section). Then, for four audiences — citizens and voters; students, parents and job-seekers; firms and workers in the sector; investors, buyers and the diaspora — give what they must come to believe, the channels, and how it will be measured (use persona segments from the context where they exist). Then the annual calendar (sector address, scorecard publication days, careers month, investor week, budget tie-in, hurricane-season update) and the education pipeline: courses, apprenticeships and scholarships by year, and who in education owns them. Only numbers from the approved scorecard may be used in public messages.",
    after: ["ambition"],
  },
  {
    key: "roadmap",
    ordinal: 10,
    label: "10. Roadmap and cost envelope",
    short: "Roadmap",
    heading: "Roadmap, delivery function and cost envelope",
    desc: "Phases, the delivery unit, the budget as ranges tied to assumptions.",
    agent: "economist",
    brief:
      "Lay out a phased roadmap over the plan's horizon in three or four phases, each with what it delivers, which projects and policies fall in it, and the gate that must be met to move on. Specify the delivery function: a small unit of three to six people in the Office of the Head of Government that tracks the projects, prepares the stocktakes and keeps the unblock ledger, and how it relates to the ministry and the Sector Council. Then give a cost envelope only as ranges tied to named assumptions, split by public budget, private investment and development partners; where no figure is grounded, write 'To be confirmed' and say what would confirm it. Close with the top five risks to delivery and the mitigation for each.",
    after: ["projects", "enablers", "measurement"],
  },
];

export const SECTOR_STAGE_BY_KEY: Record<SectorStage, SectorStageMeta> = Object.fromEntries(
  SECTOR_STAGES.map((s) => [s.key, s]),
) as Record<SectorStage, SectorStageMeta>;

export const SECTOR_STAGE_KEYS = SECTOR_STAGES.map((s) => s.key) as [SectorStage, ...SectorStage[]];

/** At most this many sectors may be national priorities at once (enforced in 0018). */
export const MAX_PRIORITY_SECTORS = 4;

export const HORIZON_OPTIONS = [3, 5, 10] as const;
