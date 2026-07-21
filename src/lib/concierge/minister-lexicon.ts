// Minister-facing lexicon and scrubber for The Concierge.
// Every requester-facing surface (wizard, dashboard, notifications, minister
// export of a deliverable) MUST import from this file. The agency side speaks
// the internal vocabulary; ministers never see it.

export type ChamberId =
  | "ledger"
  | "portfolio"
  | "scenario"
  | "fdi"
  | "narrative"
  | "cabinet"
  | "persona";

export type Lane = ChamberId;

export interface ChamberEntry {
  id: ChamberId;
  laneLabel: string;             // dashboard lane header
  requestShape: string;          // "A written brief …" — used in Step 2 cards
  requestShapeShort: string;     // 2–4 words for chips
  description: string;           // one line, minister-language
  examples: string[];            // example asks (minister voice)
  laneAccent: string;            // tailwind-safe color token class
}

export const LEXICON: Record<ChamberId, ChamberEntry> = {
  ledger: {
    id: "ledger",
    laneLabel: "The economy",
    requestShape: "A written economic brief",
    requestShapeShort: "Economic brief",
    description:
      "A short written brief on where the economy stands — the numbers that matter and what they say.",
    examples: [
      "How are we doing on growth this quarter?",
      "What is happening with our fiscal position?",
      "Where is inflation coming from?",
    ],
    laneAccent: "from-amber-500/20 to-amber-500/5",
  },
  scenario: {
    id: "scenario",
    laneLabel: "Decisions & scenarios",
    requestShape: "A decision brief with modelled scenarios",
    requestShapeShort: "Decision brief",
    description:
      "Our team will model the trade-offs of the decision you are weighing and return a short written brief with the numbers and a recommendation.",
    examples: [
      "What happens to jobs if we change VAT on tourism?",
      "Model three ways to phase out the fuel subsidy.",
      "If we raise the minimum wage 8%, what breaks?",
    ],
    laneAccent: "from-sky-500/20 to-sky-500/5",
  },
  fdi: {
    id: "fdi",
    laneLabel: "Sectors",
    requestShape: "A sector deep-dive",
    requestShapeShort: "Sector deep-dive",
    description:
      "A deep look at one sector — what it earns, who leads it, where the pressure and the openings sit.",
    examples: [
      "Give me a deep-dive on tourism.",
      "Where is the opportunity in agri-processing?",
      "Which sectors are most exposed to a US slowdown?",
    ],
    laneAccent: "from-emerald-500/20 to-emerald-500/5",
  },
  narrative: {
    id: "narrative",
    laneLabel: "Public messages",
    requestShape: "A public statement or briefing",
    requestShapeShort: "Public message",
    description:
      "A drafted public statement, press remarks or op-ed — grounded in the numbers, ready to review.",
    examples: [
      "Draft remarks for the budget speech.",
      "A statement on the storm response.",
      "An op-ed on our climate resilience plan.",
    ],
    laneAccent: "from-rose-500/20 to-rose-500/5",
  },
  cabinet: {
    id: "cabinet",
    laneLabel: "Cabinet & governance",
    requestShape: "A cabinet briefing",
    requestShapeShort: "Cabinet briefing",
    description:
      "A short paper for cabinet — one issue, the options, the risks, the recommendation.",
    examples: [
      "A cabinet paper on healthcare workforce shortages.",
      "Options for the state-owned enterprise portfolio.",
      "A one-page memo on the pension reform vote.",
    ],
    laneAccent: "from-indigo-500/20 to-indigo-500/5",
  },
  persona: {
    id: "persona",
    laneLabel: "Population & audience research",
    requestShape: "Population research",
    requestShapeShort: "Population research",
    description:
      "Structured research on how citizens think about an issue — segments, listening, findings, recommendations.",
    examples: [
      "How do young workers feel about the pension reforms?",
      "What do outer-island residents think about the ferry plan?",
      "Test three messages for the health campaign.",
    ],
    laneAccent: "from-violet-500/20 to-violet-500/5",
  },
  portfolio: {
    id: "portfolio",
    laneLabel: "Portfolio work",
    requestShape: "Portfolio work",
    requestShapeShort: "Portfolio",
    description:
      "Cross-ministry portfolio work — programme reviews, coordination briefs, delivery scorecards.",
    examples: [
      "A delivery scorecard across ministries this quarter.",
      "A coordination brief for the coastal resilience programme.",
      "A review of our top ten flagship initiatives.",
    ],
    laneAccent: "from-teal-500/20 to-teal-500/5",
  },
};

export const LANE_ORDER: ChamberId[] = [
  "ledger",
  "scenario",
  "fdi",
  "narrative",
  "cabinet",
  "persona",
  "portfolio",
];

export function laneFor(id: string | null | undefined): ChamberEntry | null {
  if (!id) return null;
  return LEXICON[id as ChamberId] ?? null;
}

// Minister-facing status labels (kept separate from internal enum values).
export const STATUS_LABEL: Record<string, { minister: string; tone: "sent" | "working" | "final" | "ready" | "closed" }> = {
  draft:       { minister: "Draft",           tone: "sent"   },
  new:         { minister: "Sent",            tone: "sent"   },
  triaged:     { minister: "With our team",   tone: "working"},
  in_progress: { minister: "With our team",   tone: "working"},
  review:      { minister: "Being finalised", tone: "final"  },
  ready:       { minister: "Ready for you",   tone: "ready"  },
  delivered:   { minister: "Delivered",       tone: "ready"  },
  accepted:    { minister: "Acted on",        tone: "closed" },
  revising:    { minister: "Being revised",   tone: "working"},
  closed:      { minister: "Closed",          tone: "closed" },
};

// Terms that must never surface to a minister. Used to lint AI output and
// agency-authored notes that will be visible to the minister.
export const BANNED_TERMS: readonly string[] = [
  "chamber",
  "chambers",
  "ledger",
  "scenario engine",
  "fdi transition studio",
  "narrative chamber",
  "cabinet room",
  "persona lab",
  "portfolio workspaces",
  "portfolio workspace",
  "second brain",
  "corpus",
  "artifact",
  "artifacts",
  "pipeline",
  "grounding",
  "grounded",
  "citation id",
  "citation ids",
  "sla",
  "queue",
  "triage",
  "workspace",
  "workspaces",
];

export interface LexiconLintResult {
  ok: boolean;
  flagged: string[];
  scrubbed: string;
}

// Lightweight scrub. Detects banned terms case-insensitively as whole words
// where possible. Returns a scrubbed version with safe replacements so the
// caller can either re-prompt the AI or, as a last resort, ship the scrubbed
// text.
export function enforceMinisterLexicon(input: string): LexiconLintResult {
  if (!input) return { ok: true, flagged: [], scrubbed: input };

  const replacements: Array<[RegExp, string]> = [
    [/\bsecond brain\b/gi, "the information we have on your country"],
    [/\bcorpus\b/gi, "the information we have on your country"],
    [/\bscenario engine\b/gi, "our modelling team"],
    [/\bfdi transition studio\b/gi, "our sector team"],
    [/\bnarrative chamber\b/gi, "our writing team"],
    [/\bcabinet room\b/gi, "our cabinet team"],
    [/\bpersona lab\b/gi, "our research team"],
    [/\bportfolio workspaces?\b/gi, "our portfolio team"],
    [/\bchamber\s*\d*\b/gi, "team"],
    [/\bchambers\b/gi, "teams"],
    [/\bartifacts?\b/gi, "documents"],
    [/\bpipelines?\b/gi, "workflow"],
    [/\bgrounded in\b/gi, "based on"],
    [/\bgrounding\b/gi, "sources"],
    [/\bcitation ids?\b/gi, "sources"],
    [/\bsla\b/gi, "response window"],
    [/\btriaged?\b/gi, "reviewed"],
    [/\bqueue(d)?\b/gi, "received"],
    [/\bworkspaces?\b/gi, "workspace"],
  ];

  let out = input;
  const flagged: string[] = [];
  for (const term of BANNED_TERMS) {
    const re = new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(out)) flagged.push(term);
  }
  for (const [re, sub] of replacements) out = out.replace(re, sub);

  return { ok: flagged.length === 0, flagged, scrubbed: out };
}

// Recursively scrub any string leaves of an object/array so structured AI
// output can be trusted on requester-facing surfaces.
export function scrubMinisterPayload<T>(value: T): T {
  if (typeof value === "string") return enforceMinisterLexicon(value).scrubbed as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubMinisterPayload(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubMinisterPayload(v);
    }
    return out as unknown as T;
  }
  return value;
}

// System prompt fragment enforced in every AI call whose output touches a
// requester-facing surface.
export const MINISTER_VOICE_SYSTEM = `
You are drafting for a Prime Minister or senior Minister. Speak the way a chief
of staff speaks to their principal: short, direct, plain, decision-oriented.

NEVER use any of these words or phrases: chamber, chambers, ledger,
scenario engine, FDI transition studio, narrative chamber, cabinet room,
persona lab, portfolio workspaces, second brain, corpus, artifact, pipeline,
grounding, citation id, SLA, queue, triage, workspace. Do not name internal
systems. Do not use "[N]" citation markers. Do not use jargon like "KPI",
"payload", "endpoint", "pipeline", "vector", "embedding".

Refer to sources in plain language ("your latest tourism revenue figures",
"IMF Article IV notes"), never as citation ids.
`.trim();
