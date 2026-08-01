// Chamber 07 · Stage 03 — instrument derivation.
//
// Server-only. Two jobs: read the approved plan's method mix and say which
// instruments this programme *must* hold, and draft any one of them from the
// brief, the supporting context and the plan. The stage UI never decides what a
// programme needs — the plan does.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import { deriveJson } from "./field-ai.server";

type Db = SupabaseClient<Database>;

export type InstrumentKind = "survey" | "discussion_guide";

export const QUESTION_TYPES = [
  "single_choice",
  "multi_choice",
  "scale",
  "ranking",
  "matrix",
  "open_text",
  "moderator_prompt",
] as const;

export interface FieldQuestion {
  id: string;
  type: (typeof QUESTION_TYPES)[number];
  prompt: string;
  help?: string;
  required?: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
  rows?: string[];
  /** 1-based index into the plan's objectives this question serves. */
  objective_ref?: number;
  /**
   * Why this question exists when it does not serve a stated objective.
   * "frontline_insight" marks the standing block that asks stakeholders where
   * the work breaks and what they would change — invention only they can name.
   */
  intent?: "frontline_insight";
}

export const FRONTLINE_INTENT = "frontline_insight" as const;

export interface DraftPayload {
  title: string;
  intro: string;
  outro?: string;
  questions: FieldQuestion[];
}

export interface InstrumentRow {
  id: string;
  study_id: string;
  country_code: string;
  kind: string;
  title: string | null;
  intro: string | null;
  outro: string | null;
  questions: FieldQuestion[];
  version: number;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequiredInstrument {
  kind: InstrumentKind;
  /** Plan method lines that resolve to this instrument. */
  methods: string[];
  audiences: string[];
}

interface MethodLine {
  method?: string;
  audience?: string;
  objective?: string;
  instrument?: string;
  sample_size?: number;
}

const SURVEY_HINTS = ["survey", "poll", "cati", "questionnaire", "omnibus", "self_completion"];
const GUIDE_HINTS = [
  "interview",
  "depth",
  "focus",
  "group",
  "panel",
  "roundtable",
  "ethnograph",
  "workshop",
  "qualitative",
];
const NO_INSTRUMENT_HINTS = ["desk", "audit", "secondary", "analysis_of"];

/** Which instruments the approved method mix obliges this programme to hold. */
export function requiredInstruments(methodMix: unknown): RequiredInstrument[] {
  const lines: MethodLine[] = Array.isArray(methodMix) ? (methodMix as MethodLine[]) : [];
  const out = new Map<InstrumentKind, RequiredInstrument>();

  for (const line of lines) {
    const hay = `${line.method ?? ""} ${line.instrument ?? ""}`.toLowerCase();
    if (!hay.trim()) continue;
    const isDesk =
      NO_INSTRUMENT_HINTS.some((h) => hay.includes(h)) &&
      !SURVEY_HINTS.some((h) => hay.includes(h)) &&
      !GUIDE_HINTS.some((h) => hay.includes(h));
    if (isDesk) continue;

    let kind: InstrumentKind | null = null;
    if (SURVEY_HINTS.some((h) => hay.includes(h))) kind = "survey";
    else if (GUIDE_HINTS.some((h) => hay.includes(h))) kind = "discussion_guide";
    if (!kind) continue;

    const entry = out.get(kind) ?? { kind, methods: [], audiences: [] };
    if (line.method && !entry.methods.includes(line.method)) entry.methods.push(line.method);
    if (line.audience && line.audience !== "N/A" && !entry.audiences.includes(line.audience)) {
      entry.audiences.push(line.audience);
    }
    out.set(kind, entry);
  }

  if (out.size === 0) return [{ kind: "survey", methods: [], audiences: [] }];
  // Survey first — it is the wider net and usually fields earliest.
  return [...out.values()].sort((a, b) => (a.kind === "survey" ? -1 : b.kind === "survey" ? 1 : 0));
}

export function isDraft(v: unknown): v is DraftPayload {
  if (!v || typeof v !== "object") return false;
  const d = v as Partial<DraftPayload>;
  return (
    typeof d.title === "string" &&
    Array.isArray(d.questions) &&
    d.questions.length > 0 &&
    d.questions.every((q) => typeof q?.prompt === "string" && typeof q?.type === "string")
  );
}

export interface StudyRow {
  id: string;
  title: string | null;
  objective: string | null;
  country_code: string;
  method: string | null;
  project_id: string | null;
}

export interface DerivationContext {
  study: StudyRow;
  planId: string | null;
  objectives: Array<{ objective: string; why?: string }>;
  methodMix: unknown;
  required: RequiredInstrument[];
  /** Plain-language list of what the draft was derived from. */
  provenance: string[];
  briefBlock: string;
  planBlock: string;
}

/** Read everything a draft is derived from, once, so the UI can show it too. */
export async function loadDerivationContext(
  supabase: Db,
  studyId: string,
): Promise<DerivationContext> {
  const { data: study, error } = await supabase
    .from("studies")
    .select("id,title,objective,country_code,method,project_id")
    .eq("id", studyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!study) throw new Error("Study not found");

  const provenance: string[] = [];
  let briefBlock = "";
  let planBlock = "";
  let objectives: Array<{ objective: string; why?: string }> = [];
  let methodMix: unknown = null;
  let planId: string | null = null;

  if (study.project_id) {
    const [{ data: project }, { data: plan }] = await Promise.all([
      supabase
        .from("persona_projects")
        .select("title,brief_raw,brief_scope")
        .eq("id", study.project_id as string)
        .maybeSingle(),
      supabase
        .from("programme_plans")
        .select("id,summary,objectives,method_mix,audience")
        .eq("project_id", study.project_id as string)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (project) {
      briefBlock = `PROGRAMME: ${project.title}\nBRIEF:\n${(project.brief_raw ?? "").slice(0, 8_000)}\nSCOPE: ${JSON.stringify(project.brief_scope ?? {}).slice(0, 3_000)}`;
      if (project.brief_raw) provenance.push("The source brief");
      if (project.brief_scope) provenance.push("The scope read-out");
    }
    if (plan) {
      planId = plan.id as string;
      objectives = Array.isArray(plan.objectives)
        ? (plan.objectives as Array<{ objective: string; why?: string }>)
        : [];
      methodMix = plan.method_mix;
      planBlock = `ACTIVE PLAN: ${plan.summary}\nOBJECTIVES: ${JSON.stringify(plan.objectives).slice(0, 2_000)}\nMETHOD MIX: ${JSON.stringify(plan.method_mix).slice(0, 2_500)}\nAUDIENCE: ${JSON.stringify(plan.audience).slice(0, 1_500)}`;
      provenance.push(`The approved plan · ${objectives.length} objectives`);
    }
  }
  if (study.objective) provenance.push("The study objective");

  return {
    study: study as StudyRow,
    planId,
    objectives,
    methodMix,
    required: requiredInstruments(methodMix),
    provenance,
    briefBlock,
    planBlock,
  };
}

function normaliseQuestions(questions: FieldQuestion[], objectiveCount: number): FieldQuestion[] {
  const used = new Set<string>();
  return questions.map((q, i) => {
    let id = (q.id ?? `q${i + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 40);
    if (!id || used.has(id)) id = `q${i + 1}`;
    used.add(id);
    const frontline = q.intent === FRONTLINE_INTENT;
    const ref =
      !frontline &&
      typeof q.objective_ref === "number" &&
      q.objective_ref >= 1 &&
      q.objective_ref <= objectiveCount
        ? Math.round(q.objective_ref)
        : undefined;
    const out: FieldQuestion = { ...q, id };
    delete out.objective_ref;
    if (ref) out.objective_ref = ref;
    if (frontline) out.intent = FRONTLINE_INTENT;
    else delete out.intent;
    return out;
  });
}

/** Does this instrument already carry the standing frontline-insight block? */
export function hasFrontlineBlock(questions: FieldQuestion[]): boolean {
  return questions.some((q) => q.intent === FRONTLINE_INTENT);
}

/**
 * The guarantee. Every instrument closes with an open invitation to the people
 * actually touching the work: where does it break, what would you change, and
 * how sure are you it would work. If the model omitted it, we append a version
 * worded to this study's own subject.
 */
function appendFrontlineBlock(
  questions: FieldQuestion[],
  kind: InstrumentKind,
  subject: string,
): FieldQuestion[] {
  if (hasFrontlineBlock(questions)) return questions;
  const s = subject.trim() || "the work covered by this study";
  const block: FieldQuestion[] =
    kind === "discussion_guide"
      ? [
          {
            id: "fi_friction",
            type: "moderator_prompt",
            prompt: `Closing round — where does ${s} break down or slow you down most in practice? Probe for the specific step, not the general complaint.`,
            help: "Frontline insight · beyond the brief.",
            intent: FRONTLINE_INTENT,
          },
          {
            id: "fi_workaround",
            type: "moderator_prompt",
            prompt: `What do you and your team already do informally to get around that? Probe for workarounds people have invented themselves.`,
            help: "Frontline insight · beyond the brief.",
            intent: FRONTLINE_INTENT,
          },
          {
            id: "fi_invention",
            type: "moderator_prompt",
            prompt: `If you could change one thing about how ${s} is done, what would you change — and what would improve as a result? Go round the room.`,
            help: "Frontline insight · beyond the brief.",
            intent: FRONTLINE_INTENT,
          },
          {
            id: "fi_referral",
            type: "moderator_prompt",
            prompt: `Who else should we be asking about this — someone closer to the work than anyone in this room?`,
            help: "Frontline insight · beyond the brief.",
            intent: FRONTLINE_INTENT,
          },
        ]
      : [
          {
            id: "fi_friction",
            type: "open_text",
            prompt: `Thinking about how ${s} works day to day, where does it break down or slow you down most?`,
            help: "In your own words — this is the part only you can tell us.",
            required: false,
            intent: FRONTLINE_INTENT,
          },
          {
            id: "fi_invention",
            type: "open_text",
            prompt: `If you could change one thing about how ${s} is done, what would you change, and what would improve?`,
            help: "One change, however small or however large.",
            required: false,
            intent: FRONTLINE_INTENT,
          },
          {
            id: "fi_confidence",
            type: "scale",
            prompt: "How confident are you that the change you described would work?",
            scale_min: 1,
            scale_max: 5,
            scale_min_label: "Not confident",
            scale_max_label: "Very confident",
            required: false,
            intent: FRONTLINE_INTENT,
          },
        ];
  return [...questions, ...block];
}

/** Draft one instrument of `kind` and persist it as the next version. */
export async function draftAndStoreInstrument(
  supabase: Db,
  ctx: DerivationContext,
  kind: InstrumentKind,
  steering?: string | null,
) {
  const { study } = ctx;
  const isGuide = kind === "discussion_guide";
  const line = ctx.required.find((r) => r.kind === kind);

  const objectiveList = ctx.objectives
    .map((o, i) => `${i + 1}. ${o.objective}${o.why ? ` — ${o.why}` : ""}`)
    .join("\n");

  const system = `You are a senior research methodologist writing a real-world research instrument for a sovereign government client. Write to THIS study's objectives. Never reach for a stock question bank, never pad with generic demographics unless an objective needs them.

${
  isGuide
    ? `You are writing a MODERATOR DISCUSSION GUIDE for live sessions. Use "moderator_prompt" for opening, warm-up, probing and closing prompts, and "open_text" only where the moderator records a structured answer. Sequence the guide so rapport is built before sensitive ground.`
    : `You are writing a SELF-COMPLETION QUESTIONNAIRE. Keep language plain and neutral, avoid double-barrelled and leading items, put sensitive questions late, and keep the whole instrument completable in a reasonable sitting.`
}

Every objective listed must be covered by at least one question. Tag each question with "objective_ref": the 1-based number of the objective it serves.

Question ids must be short, lowercase, snake_case and unique. Scale questions must set scale_min, scale_max and both labels. Choice questions must have real, mutually exclusive options.`;

  const user = `${ctx.briefBlock}

${ctx.planBlock}

STUDY: ${study.title}
OVERALL OBJECTIVE: ${study.objective ?? "(not stated — infer from the brief)"}
COUNTRY: ${study.country_code}
THIS INSTRUMENT SERVES: ${line?.methods.join(", ") || kind}${line?.audiences.length ? `\nAUDIENCES: ${line.audiences.join("; ")}` : ""}

OBJECTIVES TO COVER (use these numbers for objective_ref):
${objectiveList || "(none stated — derive from the brief)"}
${steering ? `\nSTEERING FROM THE RESEARCHER:\n${steering}` : ""}

Return JSON:
{
  "title": "instrument title",
  "intro": "what the respondent/participant is told up front, including why their input matters and how it will be used",
  "outro": "closing text",
  "questions": [{"id":"...","type":"${QUESTION_TYPES.join("|")}","prompt":"...","help":"...","required":true,"objective_ref":1,"options":["..."],"scale_min":1,"scale_max":5,"scale_min_label":"...","scale_max_label":"...","rows":["..."]}]
}`;

  const draft = await deriveJson<DraftPayload>({ system, user, validate: isDraft });
  const questions = normaliseQuestions(draft.questions, ctx.objectives.length);

  const { data: prev } = await supabase
    .from("field_instruments")
    .select("version")
    .eq("study_id", study.id)
    .order("version", { ascending: false })
    .limit(1);
  const version = ((prev?.[0]?.version as number | undefined) ?? 0) + 1;

  const { data: row, error } = await supabase
    .from("field_instruments")
    .insert({
      study_id: study.id,
      country_code: study.country_code,
      kind,
      title: draft.title,
      intro: draft.intro,
      outro: draft.outro ?? null,
      questions: questions as unknown as Json,
      version,
      generated_by: "ai",
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row as unknown as InstrumentRow;
}

/** The latest version of each instrument held against a study. */
export async function latestInstruments(supabase: Db, studyId: string): Promise<InstrumentRow[]> {
  const { data, error } = await supabase
    .from("field_instruments")
    .select("*")
    .eq("study_id", studyId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const out: InstrumentRow[] = [];
  for (const row of data ?? []) {
    const r = row as unknown as InstrumentRow;
    if (seen.has(r.kind)) continue;
    seen.add(r.kind);
    out.push({ ...r, questions: (r.questions ?? []) as FieldQuestion[] });
  }
  return out;
}
