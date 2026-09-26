// Canonical stage list for the Digital Government Studio (chamber 09).
// Import from any UI that renders or counts PRD progress; do not redefine
// locally. Each stage writes exactly one PRD section, in this order.

export type EgovStage =
  | "country_context"
  | "audiences"
  | "service_catalogue"
  | "governance_layer"
  | "government_structure"
  | "outward_layer"
  | "identity_payments_interop"
  | "brand_system"
  | "architecture"
  | "roadmap_proforma"
  | "acceptance_kpis";

export interface EgovStageMeta {
  key: EgovStage;
  ordinal: number;
  label: string;
  short: string;
  heading: string;
  desc: string;
  /** What the model is asked to write for this section. */
  brief: string;
  /** Sections that must be drafted before this one runs. */
  after: EgovStage[];
}

export const EGOV_STAGES: EgovStageMeta[] = [
  {
    key: "country_context",
    ordinal: 1,
    label: "1. Country context",
    short: "Context",
    heading: "Situation, constraints and digital readiness",
    desc: "Onboarding summaries, headline indicators, capital flows.",
    brief:
      "Describe the country's situation as it bears on a national e-government platform: population and geography, the size and shape of the economy, fiscal room, connectivity and device access, existing digital services, and the constraints a platform must design around. Close with three to five design implications.",
    after: [],
  },
  {
    key: "audiences",
    ordinal: 2,
    label: "2. Audiences",
    short: "Audiences",
    heading: "Audiences and their jobs to be done",
    desc: "Persona Lab segments and studies.",
    brief:
      "Define six audiences — citizens, businesses, the diaspora, investors and visitors, civil servants, and ministers and oversight bodies. For each: who they are in this country, the three to five things they most need from government online, the channel and language realities, and the trust conditions that must hold. Use persona segments where they exist; say where they do not.",
    after: ["country_context"],
  },
  {
    key: "service_catalogue",
    ordinal: 3,
    label: "3. Service catalogue",
    short: "Services",
    heading: "Prioritised service catalogue",
    desc: "Ministries × sectors × audiences.",
    brief:
      "Propose a prioritised catalogue of government services for the platform, grouped by owning ministry. For each service: the audience, the demand signal, the transaction type (information, application, payment, registration, licence, certificate), the data it needs, and a complexity rating of low, medium or high. Lead with the ten services to build first and say why.",
    after: ["audiences"],
  },
  {
    key: "governance_layer",
    ordinal: 4,
    label: "4. Good governance",
    short: "Governance",
    heading: "Good-governance layer",
    desc: "Mandate Compact, Cabinet commitments, standards gaps, procurement.",
    brief:
      "Specify the good-governance features: an open-data portal, procurement transparency, a public commitments tracker that draws on the Mandate Compact and Cabinet commitments, budget publication, freedom-of-information handling, and a feedback and complaints loop. For each: what is published, at what cadence, by whom, and what standard it follows. Note where the standards audit shows data gaps.",
    after: ["country_context"],
  },
  {
    key: "government_structure",
    ordinal: 5,
    label: "5. Government, Cabinet and statutory bodies",
    short: "Government",
    heading: "Government, Cabinet and statutory bodies",
    desc: "Offices of state, Cabinet, ministries and statutory bodies — the site's directory.",
    brief:
      "Specify how the platform presents the machinery of government, from the government lines provided. Cover: the Head of State and Governor-General; the Office of the Prime Minister (a page with the Prime Minister's role, portfolio responsibilities and the office's services); the Cabinet (a page listing every member in order of precedence with title, portfolio, portrait and office contact, and how Cabinet decisions are published); a page for every ministry (minister, mandate, programmes, the statutory bodies under it, and its services); and a page for every statutory body (its enabling Act, mandate, head, board, services, website and contact). Then specify the directory and organisation chart, search across ministries and bodies, and a table mapping each statutory body to the public services it owns in the service catalogue. State that this content is fed by GDPVision's government resource, refreshed on every sync, and that nothing here is typed by hand into the platform. List every ministry and body named in the context; where the context names none, say so in the Gaps list and name the source that would supply it (the government portal, the Laws of the country, the Gazette).",
    after: ["country_context"],
  },
  {
    key: "outward_layer",
    ordinal: 6,
    label: "6. Outward-facing",
    short: "Outward",
    heading: "Outward-facing layer: invest, visit, relocate",
    desc: "Investment pipeline, sector dossiers, narrative signals.",
    brief:
      "Specify the outward-facing layer for people outside the country: the country brand and narrative, an invest journey that hands off to approved investor materials, a visit journey, a relocate and diaspora journey, and the sector stories worth telling. Only reference approved projects. Say what must not be shown.",
    after: ["audiences"],
  },
  {
    key: "identity_payments_interop",
    ordinal: 7,
    label: "7. Identity, payments, interoperability",
    short: "Identity",
    heading: "Identity, payments, interoperability and data protection",
    desc: "Research waterfall, CARICOM registry.",
    brief:
      "Specify digital identity (enrolment, assurance levels, sign-in), the payments rail (methods, reconciliation, refunds, fees), the data-exchange layer between ministries (registry pattern, consent, audit), and data-protection obligations, including regional alignment. Distinguish what exists today from what must be built, and name the decision the Cabinet must take.",
    after: ["service_catalogue"],
  },
  {
    key: "brand_system",
    ordinal: 8,
    label: "8. Brand system",
    short: "Brand",
    heading: "Brand system, marks and imagery",
    desc: "Flag tokens, logo and favicon, photography plan.",
    brief:
      "Describe the brand system for the platform from the tokens provided: how each colour is used (type, borders, rules, a single accent), typography, spacing, iconography, and the accessibility contrast results. State the rules plainly: light surfaces, colour in borders and accents only, no reversed-out text on dark fills, one accent. Then specify the marks: the national flag is the platform's primary logo (vector flag beside the platform name in the ink colour) and its favicon and touch icon, in the sizes given; no other emblem unless the government supplies its official arms. Then specify the imagery: the documentary photography style, the rules for alt text, captions, consent and framing, and the required image sets per landing page, audience, priority service, journey and governance tool, from the imagery lines provided. A platform built from this section must not ship without those image sets.",
    after: [],
  },
  {
    key: "architecture",
    ordinal: 9,
    label: "9. Architecture",
    short: "Architecture",
    heading: "Architecture, tenancy and the GDPVision connection",
    desc: "Repository index, maps and the public API contract.",
    brief:
      "Specify the platform architecture as a separate product in its own repository: stack, hosting, environments, tenancy, content management, observability and security baseline. Then specify the GDPVision connection exactly as the API contract lines describe it: the handshake, the keyed read-only endpoints per resource, the incremental sync with ?since, the sync interval, the last-good-copy rule when GDPVision is unreachable, which page or feature of the platform each resource feeds (indicators to the national figures, commitments to the commitments tracker, government to the Office of the Prime Minister, Cabinet, ministry and statutory-body pages, ministries to the ministry pages, datasets to the open-data portal, procurement to tenders, projects to the invest journey, sectors to the sector pages, brand to the chrome), and the environment variables the platform needs. State what never leaves GDPVision. Ground the rest of the section in the repository index provided.",
    after: [
      "service_catalogue",
      "governance_layer",
      "government_structure",
      "outward_layer",
      "identity_payments_interop",
    ],
  },
  {
    key: "roadmap_proforma",
    ordinal: 10,
    label: "10. Roadmap",
    short: "Roadmap",
    heading: "Roadmap, staffing and cost envelope",
    desc: "Phases and a cost envelope.",
    brief:
      "Lay out a phased roadmap of three to four phases with what each delivers, the team it needs, and the dependencies between phases. Give a cost envelope only as ranges tied to named assumptions; where no figure is grounded, write 'To be confirmed' and say what would confirm it.",
    after: ["architecture"],
  },
  {
    key: "acceptance_kpis",
    ordinal: 11,
    label: "11. Acceptance",
    short: "Acceptance",
    heading: "Acceptance criteria and outcome indicators",
    desc: "Country indicators.",
    brief:
      "Define acceptance criteria for launch and outcome indicators per audience. Launch criteria must include: every office, ministry and statutory body in GDPVision's government record has its page, and every page is fed by the API rather than typed in. Then the outcome indicators: what is measured, the baseline where the ledger holds one, the target direction, and who owns each. Prefer indicators the country already publishes.",
    after: ["service_catalogue", "governance_layer", "government_structure"],
  },
];

export const EGOV_STAGE_BY_KEY: Record<EgovStage, EgovStageMeta> = Object.fromEntries(
  EGOV_STAGES.map((s) => [s.key, s]),
) as Record<EgovStage, EgovStageMeta>;

export const EGOV_STAGE_KEYS = EGOV_STAGES.map((s) => s.key) as [EgovStage, ...EgovStage[]];

export const AUDIENCE_OPTIONS = [
  { key: "citizens", label: "Citizens" },
  { key: "businesses", label: "Businesses" },
  { key: "diaspora", label: "Diaspora" },
  { key: "investors_visitors", label: "Investors and visitors" },
  { key: "civil_servants", label: "Civil servants" },
  { key: "ministers_oversight", label: "Ministers and oversight bodies" },
] as const;

export const PRIORITY_OPTIONS = [
  { key: "services", label: "Government services" },
  { key: "governance", label: "Good governance and transparency" },
  { key: "outward", label: "Country brand, invest and visit" },
  { key: "identity", label: "Digital identity and payments" },
] as const;
