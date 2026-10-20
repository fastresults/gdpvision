// Routing + working-session content for the Chamber Decision Journeys presentation.
// Everything is derived deterministically from each journey's own flow — nothing random.
import { CHAMBER_NAMES, type Scenario } from "../dataDecisionScenarios";
import type { ChamberJourney } from "../chamberDecisionJourneys";

export const CHAMBER_PURPOSE: Record<string, string> = {
  "01": "What the national numbers really say",
  "02": "Which ministry leads each priority",
  "03": "What happens if we act — or don't",
  "04": "How to win and keep investment",
  "05": "What we say, truthfully and fast",
  "06": "What Cabinet decides, in what order",
  "07": "How people will react before we act",
  "08": "Which promises get delivered, by whom",
  "09": "How a public service gets rebuilt",
  "10": "Which sectors grow, and how",
};

const NOT_LEAD: Record<string, string> = {
  "01": "Not a question of the national figures",
  "02": "Another workspace leads this priority",
  "03": "No modelling of shocks needed first",
  "04": "No investor or capital at stake",
  "05": "Not a public-message problem",
  "06": "Not yet ready for Cabinet ordering",
  "07": "No public reaction to test first",
  "08": "Not a manifesto-delivery question",
  "09": "No public service to redesign",
  "10": "Not a sector growth plan",
};

export interface StagePlay {
  ask: string;
  safeguard: string;
  signoff: string;
}

const sp = (ask: string, safeguard: string, signoff: string): StagePlay => ({
  ask,
  safeguard,
  signoff,
});

export const STAGE_PLAYBOOK: Record<string, StagePlay[]> = {
  "01": [
    sp("What exactly is being challenged?", "Question logged with its source", "Statistics office"),
    sp("Which official figures apply?", "Every figure cited and graded", "Statistics office"),
    sp("Which sectors move with it?", "Links traced to national accounts", "Finance"),
    sp("Why did the number move?", "Assumptions shown, not hidden", "Finance"),
    sp("What is our one position?", "Weak figures flagged before release", "Minister of Finance"),
  ],
  "02": [
    sp("What does the mandate say?", "Mandate read from the gazette", "Cabinet Secretary"),
    sp("Who has real influence?", "Influence scored on trusted data", "Cabinet Secretary"),
    sp(
      "Where do ministries depend on each other?",
      "Overlaps shown to both ministers",
      "Ministers concerned",
    ),
    sp("Who owns the result?", "One lead, with supporting roles recorded", "Prime Minister"),
    sp("What happens next, by when?", "Action logged with a date", "Accountable minister"),
  ],
  "03": [
    sp("Where are we today?", "Baseline from cited national data", "Treasury"),
    sp("Which change or disruption should we test?", "Every assumption recorded", "Treasury"),
    sp("What economic effects can the model estimate?", "Ranges shown, not false precision", "Chief Economist"),
    sp("How do the costs and trade-offs compare?", "Trade-offs set side by side", "Minister of Finance"),
    sp("What goes to Cabinet?", "Cabinet paper checked before release", "Minister of Finance"),
  ],
  "04": [
    sp("How exposed are we?", "Exposure priced from cited flows", "Investment agency"),
    sp(
      "Are we ready — law, land, people?",
      "Readiness checked against standards",
      "Investment agency",
    ),
    sp("What must replace or attract it?", "Target tied to GDP and jobs", "Treasury"),
    sp("What will we offer — and not?", "Compare incentives with expected national value", "Minister of Finance"),
    sp("What does the investor receive?", "Open-standard investor file", "Minister of Investment"),
  ],
  "05": [
    sp("What is being said, and where?", "Signal logged with its source", "Communications unit"),
    sp("What are the verified facts?", "Only approved facts used", "Cabinet Office"),
    sp("What is the national position?", "Position tied to data", "Prime Minister's office"),
    sp("Does it survive challenge?", "Tested against opposition lines", "Communications unit"),
    sp("Who releases it, when?", "Responsible leader approves release", "Prime Minister"),
  ],
  "06": [
    sp("What must be decided first?", "Queue ranked by value and urgency", "Cabinet Secretary"),
    sp("Is the data good enough?", "Data grade checked", "Cabinet Secretary"),
    sp("What are the real options?", "Options costed side by side", "Ministers concerned"),
    sp("What did Cabinet decide?", "Decision minuted and kept", "Cabinet"),
    sp("Who delivers it, by when?", "Commitment tracked to completion", "Accountable minister"),
  ],
  "07": [
    sp("What exactly are we proposing?", "Proposal fixed before testing", "Policy unit"),
    sp("Who will this affect?", "Audiences built from national data", "Policy unit"),
    sp("What reactions might simulated profiles suggest?", "Private data stays in country", "Persona Lab"),
    sp("What concerns need further review?", "Findings graded and explainable", "Policy unit"),
    sp("What do we change first?", "Revisions logged before release", "Minister concerned"),
  ],
  "08": [
    sp("What exactly was promised?", "Pledge quoted from the manifesto", "Delivery unit"),
    sp("Which national priority does it serve?", "Pillar agreed by Cabinet", "Delivery unit"),
    sp("What will actually be delivered?", "Deliverable costed", "Treasury"),
    sp("Who delivers, by when, and how do we track it?", "Leader, progress measure and date recorded", "Accountable minister"),
    sp("Is it on track this quarter?", "Progress published on the record", "Prime Minister"),
  ],
  "09": [
    sp("Where does the service fail people?", "Problem measured, not assumed", "Digital agency"),
    sp("What must the service do?", "Requirements under privacy rules", "Digital agency"),
    sp("What will citizens see?", "Designed with national branding", "Digital agency"),
    sp("Is it safe to launch?", "Independent approval required", "Minister concerned"),
    sp("Is it working?", "Uptake and time saved measured", "Cabinet Room"),
  ],
  "10": [
    sp("What does the sector data show?", "Sector data cited and graded", "Sector ministry"),
    sp("Which priority comes first?", "Head of Government chooses", "Prime Minister"),
    sp("What holds the sector back?", "Constraint backed by trusted data", "Sector ministry"),
    sp("Which projects, which roadmap?", "Projects with owners and funders", "Sector ministry"),
    sp("Does Cabinet commit?", "Commitment tracked through Cabinet", "Cabinet"),
  ],
};

const SOURCE_LABEL: Record<string, string> = {
  stats: "National statistics",
  peers: "Peer benchmarks",
  flows: "Investment and trade figures",
  kpis: "Delivery progress measures",
  ministries: "Ministry mandates",
  manifestos: "Manifesto pledges",
  private: "Protected government records",
};
const SIGNAL_LABEL: Record<string, string> = {
  stats: "Economy",
  peers: "Competitiveness",
  flows: "Money in motion",
  kpis: "Delivery",
  ministries: "Ownership",
  manifestos: "Mandate",
  private: "Confidential",
};
const GRADE: Record<string, string> = {
  stats: "A",
  peers: "B",
  flows: "B",
  kpis: "A",
  ministries: "A",
  manifestos: "B",
  private: "A",
};

const nodes = (journey: Scenario) => journey.steps.flatMap((s) => s.edges.flat());

export interface EvidenceChip {
  id: string;
  label: string;
  inCountry: boolean;
  grade: string;
}

export function evidenceChips(journey: Scenario): EvidenceChip[] {
  const seen = Array.from(new Set(nodes(journey).filter((n) => SOURCE_LABEL[n])));
  const chips: EvidenceChip[] = seen.map((id) => ({
    id,
    label: SOURCE_LABEL[id],
    inCountry: id === "private",
    grade: GRADE[id],
  }));
  if (nodes(journey).includes("corpus"))
    chips.push({ id: "corpus", label: "National data library", inCountry: false, grade: "A" });
  if (nodes(journey).includes("vault"))
    chips.push({ id: "vault", label: "Sovereign Vault", inCountry: true, grade: "A" });
  if (nodes(journey).includes("safeguards"))
    chips.push({ id: "safeguards", label: "Sources and reliability", inCountry: false, grade: "A" });
  return chips;
}

const STOP = new Set(["should", "which", "about", "their", "there", "where", "would", "before"]);

export function questionSignals(journey: ChamberJourney) {
  const words = journey.question
    .replace(/[—?.,'’]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOP.has(w.toLowerCase()));
  const keywords = Array.from(new Set(words))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
  const sources = Array.from(new Set(nodes(journey).filter((n) => SIGNAL_LABEL[n])));
  const tags = [journey.profile.kind, ...sources.map((s) => SIGNAL_LABEL[s])].slice(0, 4);
  return { keywords, tags };
}

export interface ChamberFit {
  index: string;
  name: string;
  purpose: string;
  fit: number;
  role: "lead" | "support" | "other";
  reason: string;
}

export function routing(journey: ChamberJourney): ChamberFit[] {
  const touched = new Set(
    nodes(journey)
      .filter((n) => /^c\d\d$/.test(n))
      .map((n) => n.slice(1)),
  );
  return Object.keys(CHAMBER_NAMES).map((index) => {
    const seed = (parseInt(index, 10) * 7 + journey.title.length) % 17;
    if (index === journey.chamber)
      return {
        index,
        name: CHAMBER_NAMES[index],
        purpose: CHAMBER_PURPOSE[index],
        fit: 94,
        role: "lead",
        reason: `Leads — ${CHAMBER_PURPOSE[index].toLowerCase()}`,
      };
    if (touched.has(index))
      return {
        index,
        name: CHAMBER_NAMES[index],
        purpose: CHAMBER_PURPOSE[index],
        fit: 58 + seed,
        role: "support",
        reason: `Called in — ${CHAMBER_PURPOSE[index].toLowerCase()}`,
      };
    return {
      index,
      name: CHAMBER_NAMES[index],
      purpose: CHAMBER_PURPOSE[index],
      fit: 8 + seed,
      role: "other",
      reason: NOT_LEAD[index],
    };
  });
}
