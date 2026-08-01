// Chamber 07 · Commencement deck — server-only assembler.
//
// Turns the stored commencement briefing into a presentable slide deck that
// walks the client through the agency's order of process:
//   brief → programme → participants → instruments → fieldwork → evidence →
//   expected outcome.
//
// The spine (figures, dates, section order) is computed from the briefing
// document — never invented. Only the slide headline, its ≤4 bullets and a
// one-line note are written by the model, and every one of them falls back to
// deterministic prose lifted from the briefing when the model is unavailable.

import type { CommencementBriefing } from "./commencement-briefing.server";
import {
  assertClientOutputClean,
  makePreflightItem,
  type OutputPreflightItem,
} from "./client-output-provenance.server";
import { deriveJson } from "./field-ai.server";

export type DeckSlideKind =
  | "cover"
  | "orientation"
  | "stage"
  | "timeline"
  | "outcome"
  | "closing";

export interface DeckStat {
  label: string;
  value: string;
  note?: string;
}

export interface DeckRow {
  left: string;
  right: string;
}

export interface DeckSlide {
  id: string;
  kind: DeckSlideKind;
  /** Step number in the order of process, when this slide is a stage. */
  step?: number;
  eyebrow: string;
  heading: string;
  subheading?: string;
  bullets?: string[];
  stats?: DeckStat[];
  rows?: DeckRow[];
  note?: string;
}

export interface ProgrammeDeck {
  version: number;
  countryCode: string;
  programmeId: string;
  programmeTitle: string;
  title: string;
  subtitle: string;
  assembled_at: string;
  window: { starts_on: string | null; ends_on: string | null; duration_days: number | null };
  slides: DeckSlide[];
  briefingVersion: number;
  preflight: OutputPreflightItem[];
}

// ── helpers ────────────────────────────────────────────────────────────────

function dateLabel(d: string | null | undefined): string {
  if (!d) return "—";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Trim markdown to plain prose sentences we can fall back on. */
function plainSentences(md: string, max: number): string[] {
  const text = md
    .replace(/\|[^\n]*\|/g, " ") // tables
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const out: string[] = [];
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const s = raw.trim();
    if (s.length < 24) continue;
    out.push(s.length > 150 ? `${s.slice(0, 147).trimEnd()}…` : s);
    if (out.length >= max) break;
  }
  return out;
}

function clampWords(s: string, words: number): string {
  const parts = s.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length <= words) return s.trim().replace(/[.]$/, "");
  return `${parts.slice(0, words).join(" ")}…`;
}

function section(brief: CommencementBriefing, id: string) {
  return brief.sections.find((s) => s.id === id) ?? null;
}

// ── the AI copy pass ───────────────────────────────────────────────────────

const DECK_SYSTEM = `You are a senior research director at a top-tier strategy firm writing the speaker-facing slide copy for a commencement deck a sovereign government client will be shown before fieldwork begins.

Voice: calm, precise, non-promotional British English. Address the client directly. Never invent facts, numbers, names or dates — use only what the supplied briefing text contains. No markdown, no emoji, no trailing full stops on bullets.

Hard constraint: this deck belongs to the client's own programme. Never name the platform, product, vendor tooling, internal chambers, workspaces or any internal system (no "GDPVision", no "Chamber", no "second brain", no chamber names). Refer only to the client, this programme, its participants and its deliverables.

For each slide you are given an id and the briefing text behind it. Return JSON of the shape:
{"slides":[{"id":"<same id>","heading":"<max 8 words>","subheading":"<max 16 words>","bullets":["<max 14 words>", ...max 4],"note":"<max 20 words>"}]}

Rules:
- heading states the point of the slide, not the section label.
- bullets are the substance a minister needs: what happens, who is involved, what comes out. Never more than 4.
- note is one line the presenter can close the slide on.
- Return an entry for every id supplied, in the same order.`;

interface AiSlideCopy {
  id: string;
  heading: string;
  subheading?: string;
  bullets?: string[];
  note?: string;
}

function isAiCopy(v: unknown): v is { slides: AiSlideCopy[] } {
  if (!v || typeof v !== "object") return false;
  const slides = (v as { slides?: unknown }).slides;
  if (!Array.isArray(slides) || slides.length === 0) return false;
  return slides.every(
    (s) =>
      !!s &&
      typeof s === "object" &&
      typeof (s as AiSlideCopy).id === "string" &&
      typeof (s as AiSlideCopy).heading === "string" &&
      (s as AiSlideCopy).heading.trim().length > 2,
  );
}

async function writeSlideCopy(
  input: Array<{ id: string; label: string; source: string }>,
): Promise<Map<string, AiSlideCopy>> {
  const out = new Map<string, AiSlideCopy>();
  try {
    const user = input
      .map((s) => `## id: ${s.id}\n### ${s.label}\n${s.source.slice(0, 3500)}`)
      .join("\n\n");
    const res = await deriveJson<{ slides: AiSlideCopy[] }>({
      system: DECK_SYSTEM,
      user,
      validate: isAiCopy,
    });
    assertClientOutputClean(res, "Generated presentation copy");
    for (const s of res.slides) out.set(s.id, s);
  } catch {
    /* deterministic fallbacks below */
  }
  return out;
}

// ── the assembler ──────────────────────────────────────────────────────────

interface StageSpec {
  id: string;
  sectionId: string;
  label: string;
  eyebrow: string;
  fallbackHeading: string;
  stats: DeckStat[];
}

export function buildDeckSpine(brief: CommencementBriefing): StageSpec[] {
  const m = brief.metrics;
  return [
    {
      id: "brief",
      sectionId: "brief",
      label: "The brief as we understood it",
      eyebrow: "Step 01 · The brief",
      fallbackHeading: "Your ask, restated",
      stats: [],
    },
    {
      id: "programme",
      sectionId: "programme",
      label: "The programme and its dates",
      eyebrow: "Step 02 · The programme",
      fallbackHeading: "How the work is phased",
      stats: [
        { label: "Phases", value: String(m.phases) },
        { label: "Milestones", value: String(m.milestones) },
        { label: "Deliverables", value: String(m.deliverables) },
      ],
    },
    {
      id: "participants",
      sectionId: "participants",
      label: "The target personas we will hear from",
      eyebrow: "Step 03 · Participants",
      fallbackHeading: "Who we will hear from",
      stats: [{ label: "Participants recruited", value: String(m.participants) }],
    },
    {
      id: "instruments",
      sectionId: "instruments",
      label: "The instruments and the questions",
      eyebrow: "Step 04 · Instruments",
      fallbackHeading: "What we will ask",
      stats: [
        { label: "Instruments", value: String(m.instruments) },
        { label: "Questions", value: String(m.questions) },
      ],
    },
    {
      id: "fieldwork",
      sectionId: "fieldwork",
      label: "How the fieldwork will be run",
      eyebrow: "Step 05 · Fieldwork",
      fallbackHeading: "How the field is run",
      stats: [{ label: "Waves", value: String(m.waves) }],
    },
    {
      id: "evidence",
      sectionId: "evidence",
      label: "How the evidence is judged and filed",
      eyebrow: "Step 06 · Evidence",
      fallbackHeading: "How evidence is judged",
      stats: [],
    },
  ];
}

export async function assembleDeck(brief: CommencementBriefing): Promise<ProgrammeDeck> {
  const spine = buildDeckSpine(brief);
  const approach = section(brief, "approach");
  const outcome = section(brief, "expected-outcome");

  const copyInput = [
    ...spine.map((s) => ({
      id: s.id,
      label: s.label,
      source: section(brief, s.sectionId)?.body_md ?? "",
    })),
    {
      id: "orientation",
      label: "The approach in one slide",
      source: approach?.body_md ?? "",
    },
    {
      id: "outcome",
      label: "What we will hand back against your brief",
      source: outcome?.body_md ?? "",
    },
  ].filter((s) => s.source.trim().length > 0);

  const copy = await writeSlideCopy(copyInput);

  const slideFrom = (
    id: string,
    kind: DeckSlideKind,
    eyebrow: string,
    fallbackHeading: string,
    sourceMd: string,
    extra: Partial<DeckSlide> = {},
  ): DeckSlide => {
    const ai = copy.get(id);
    const fallbackBullets = plainSentences(sourceMd, 4).map((s) => clampWords(s, 16));
    const bullets = (ai?.bullets ?? fallbackBullets)
      .filter((b) => typeof b === "string" && b.trim().length > 3)
      .slice(0, 4)
      .map((b) => clampWords(b.replace(/\s*[.]$/, ""), 16));
    return {
      id,
      kind,
      eyebrow,
      heading: clampWords(ai?.heading?.trim() || fallbackHeading, 9),
      subheading: ai?.subheading ? clampWords(ai.subheading, 18) : undefined,
      bullets: bullets.length > 0 ? bullets : undefined,
      note: ai?.note ? clampWords(ai.note, 22) : undefined,
      ...extra,
    };
  };

  const slides: DeckSlide[] = [];

  // Cover
  slides.push({
    id: "cover",
    kind: "cover",
    eyebrow: `${brief.countryCode} · Commencement deck`,
    heading: brief.programmeTitle,
    subheading: brief.subtitle,
    note: `${dateLabel(brief.window.starts_on)} — ${dateLabel(brief.window.ends_on)}`,
  });

  // Orientation — the approach, plus the order of process as a ladder.
  const orientation = slideFrom(
    "orientation",
    "orientation",
    "Orientation",
    "The approach in one slide",
    approach?.body_md ?? "",
    {
      rows: spine.map((s, i) => ({
        left: `${String(i + 1).padStart(2, "0")}`,
        right: s.label,
      })),
      stats: [
        { label: "Phases", value: String(brief.metrics.phases) },
        {
          label: "Window",
          value:
            brief.window.duration_days != null ? `${brief.window.duration_days} days` : "—",
          note: `${dateLabel(brief.window.starts_on)} → ${dateLabel(brief.window.ends_on)}`,
        },
        { label: "Deliverables", value: String(brief.metrics.deliverables) },
      ],
    },
  );
  slides.push(orientation);

  // The six process stages.
  spine.forEach((s, i) => {
    const sec = section(brief, s.sectionId);
    slides.push(
      slideFrom(s.id, "stage", s.eyebrow, s.fallbackHeading, sec?.body_md ?? "", {
        step: i + 1,
        stats: s.stats.length > 0 ? s.stats : undefined,
      }),
    );
  });

  // Timeline — readiness at issue reads as the state of play.
  slides.push({
    id: "timeline",
    kind: "timeline",
    eyebrow: "State of play",
    heading: "Where the programme stands today",
    rows: brief.readiness.map((r) => ({
      left: r.label,
      right: `${r.ready ? "Ready" : "In progress"} — ${clampWords(r.detail, 14)}`,
    })),
    note: `Assembled ${dateLabel(brief.assembled_at)} · briefing v${brief.version}`,
  });

  // Expected outcome, against the brief.
  slides.push(
    slideFrom(
      "outcome",
      "outcome",
      "Against your brief",
      "What you get back",
      outcome?.body_md ?? "",
      {
        stats: [
          { label: "Deliverables", value: String(brief.metrics.deliverables) },
          { label: "Read-out by", value: dateLabel(brief.window.ends_on) },
        ],
      },
    ),
  );

  // Closing
  slides.push({
    id: "closing",
    kind: "closing",
    eyebrow: brief.countryCode,
    heading: "Ready to commence",
    subheading: "On your approval, recruitment and fieldwork open against the dates above.",
    note: `${brief.programmeTitle} · Commencement briefing v${brief.version}`,
  });

  assertClientOutputClean(slides, "Programme presentation deck");
  const preflight = slides.map((slide) =>
    makePreflightItem(
      slide.id,
      slide.id === "brief" || slide.id === "cover" ? "governing_brief" : "approved_plan",
      slide,
    ),
  );

  return {
    version: brief.version,
    countryCode: brief.countryCode,
    programmeId: brief.programmeId,
    programmeTitle: brief.programmeTitle,
    title: brief.title,
    subtitle: brief.subtitle,
    assembled_at: new Date().toISOString(),
    window: brief.window,
    slides,
    briefingVersion: brief.version,
    preflight,
  };
}
