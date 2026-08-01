// Chamber 07 · Research tracks.
//
// A research programme runs on one of two tracks — or both. Track is a
// property of the programme (persona_projects.track), not a global mode, so
// a country can run a synthetic rehearsal and a field programme side by side.

export const RESEARCH_TRACKS = ["synthetic", "field", "blended"] as const;
export type ResearchTrack = (typeof RESEARCH_TRACKS)[number];

export type TrackMeta = {
  key: ResearchTrack;
  label: string;
  promise: string;
  tempo: string;
  body: string;
  proof: string;
  bullets: string[];
};

export const TRACK_META: Record<ResearchTrack, TrackMeta> = {
  synthetic: {
    key: "synthetic",
    label: "Synthetic Lab",
    promise: "Ask a synthetic public — today.",
    tempo: "Minutes",
    body: "AI casts a public from the national corpus, groups it into audiences a Cabinet can act on, and rehearses the conversation before you have it.",
    proof: "Directional, not defensible",
    bullets: ["Cast personas", "Group segments", "Rehearse studies"],
  },
  field: {
    key: "field",
    label: "Field Programme",
    promise: "Ask the real public — properly.",
    tempo: "Weeks",
    body: "The brief becomes a dated programme: phases, milestones, participants, instruments and sessions — every return filed to the second brain.",
    proof: "Citable evidence",
    bullets: ["Programme plan", "Participants & comms", "Instruments & fieldwork"],
  },
  blended: {
    key: "blended",
    label: "Rehearse, then verify",
    promise: "Run both — and see where they diverge.",
    tempo: "Minutes, then weeks",
    body: "Take the synthetic pass first for a same-day read, then field-test what it predicted. Calibration shows exactly where the model was wrong.",
    proof: "Directional today, defensible later",
    bullets: ["Everything in both tracks", "Synthetic-vs-field calibration"],
  },
};

export function isResearchTrack(v: unknown): v is ResearchTrack {
  return typeof v === "string" && (RESEARCH_TRACKS as readonly string[]).includes(v);
}

/** Which rails a programme on this track may open. */
export function tracksFor(track: ResearchTrack): { synthetic: boolean; field: boolean } {
  return {
    synthetic: track === "synthetic" || track === "blended",
    field: track === "field" || track === "blended",
  };
}
