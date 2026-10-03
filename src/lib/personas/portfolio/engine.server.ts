// Chamber 07 · Ministers track — the run engine. Server-only.
//
// One tick = one unit of work under an advisory lock on the set row, so a run
// survives a closed tab, a double click or two open windows, and resumes from
// wherever it stopped:
//
//   scope       build the grounding pack (corpus + cited research)
//   matrix      deterministic, balanced design matrix (no model)
//   generate    five personas per tick against their matrix cells
//   qa          duplicate and real-person checks; regenerates failing slots
//               (at most two retries each)
//   aggregate   the deterministic count (aggregate.ts)
//   synthesise  the Ideal Minister Profile; for the Prime Minister, also from
//               the approved profiles of the other portfolios
//   overlay     (country sets) re-weight the approved regional profile
//
// Every model output is validated by zod; citations are resolved against the
// pack by key, and any key the model invents is dropped.

import { z } from "zod";

import { db, type AnyClient } from "@/lib/syndication/db";

import { computeAggregates, topSkills } from "./aggregate";
import {
  COMMON_AXES,
  GENERATE_BATCH,
  OCEAN_KEYS,
  REGIONAL,
  SKILL_FAMILIES,
  STYLE_KEYS,
  hasProfile,
  isMatrix,
  phasesFor,
  type Aggregates,
  type Citation,
  type ContextLine,
  type DesignMatrix,
  type IdealProfile,
  type MatrixAxis,
  type Phase,
  type PhaseLogEntry,
  type PersonaRow,
  type PortfolioRow,
  type ProposedSkill,
  type SetRow,
  type SkillRow,
  type SynthesisRow,
} from "./db";
import { checkPersonas, digest, normalizedKey, thresholdsFor, type RealHolder } from "./qa";

// Longer than one structured call with its retry (two attempts of up to
// 16k output tokens), so a slow step is not picked up by a second window.
const LOCK_SECONDS = 360;
const MAX_RETRIES = 2;
export const PM_MIN_INPUTS = 3;

export const SET_COLS =
  "id,portfolio_code,scope_key,kind,base_set_id,version,title,target_size,status,phase,run_state,lock_until,run_error,phase_log,design_matrix,context,context_hash,proposed_skills,model,created_by,submitted_by,submitted_at,approved_by,approved_at,approval_mode,returned_by,returned_at,returned_note,created_at,updated_at";
export const PERSONA_COLS =
  "id,set_id,scope_key,slot_index,matrix_cell,name,archetype,career_route,summary,attributes,ocean,decision_style,skills,citations,qa,normalized_key,model,created_at,updated_at";
export const SYNTH_COLS =
  "id,set_id,scope_key,portfolio_code,aggregates,profile,narrative_md,citations,input_synthesis_ids,model,edited_by,edited_at,created_at,updated_at";

// ------------------------------------------------------------------ loaders

export async function loadPortfolio(sb: AnyClient, code: string): Promise<PortfolioRow> {
  const { data, error } = await db(sb)
    .from("ministry_portfolios")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Unknown portfolio ${code}.`);
  return data as PortfolioRow;
}

export async function loadSkills(sb: AnyClient): Promise<SkillRow[]> {
  const { data, error } = await db(sb).from("portfolio_skills").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillRow[];
}

export async function loadSet(sb: AnyClient, id: string): Promise<SetRow> {
  const { data, error } = await db(sb)
    .from("portfolio_persona_sets")
    .select(SET_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That profile was not found, or you don't have access to it.");
  return data as SetRow;
}

export async function loadPersonas(sb: AnyClient, setId: string): Promise<PersonaRow[]> {
  const { data, error } = await db(sb)
    .from("portfolio_personas")
    .select(PERSONA_COLS)
    .eq("set_id", setId)
    .order("slot_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonaRow[];
}

export async function loadSynthesis(sb: AnyClient, setId: string): Promise<SynthesisRow | null> {
  const { data, error } = await db(sb)
    .from("portfolio_persona_syntheses")
    .select(SYNTH_COLS)
    .eq("set_id", setId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SynthesisRow | null) ?? null;
}

/** Approved syntheses of every other ministry portfolio in this scope. */
export async function loadPmInputs(
  sb: AnyClient,
  scope: string,
): Promise<Array<{ set: SetRow; synthesis: SynthesisRow; portfolio: PortfolioRow }>> {
  const c = db(sb);
  const { data: sets, error } = await c
    .from("portfolio_persona_sets")
    .select(SET_COLS)
    .eq("scope_key", scope)
    .eq("status", "approved")
    .neq("portfolio_code", "PM")
    .neq("portfolio_code", "LOO");
  if (error) throw new Error(error.message);
  const ss = (sets ?? []) as SetRow[];
  if (!ss.length) return [];
  const [{ data: synths, error: e1 }, { data: ports, error: e2 }] = await Promise.all([
    c
      .from("portfolio_persona_syntheses")
      .select(SYNTH_COLS)
      .in(
        "set_id",
        ss.map((s) => s.id),
      ),
    c
      .from("ministry_portfolios")
      .select("*")
      .in(
        "code",
        ss.map((s) => s.portfolio_code),
      ),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const byId = new Map(((synths ?? []) as SynthesisRow[]).map((x) => [x.set_id, x]));
  const pByCode = new Map(((ports ?? []) as PortfolioRow[]).map((p) => [p.code, p]));
  return ss
    .map((s) => ({ set: s, synthesis: byId.get(s.id)!, portfolio: pByCode.get(s.portfolio_code)! }))
    .filter((x) => x.synthesis && x.portfolio && hasProfile(x.synthesis.profile))
    .sort((a, b) => a.portfolio.sort_order - b.portfolio.sort_order);
}

// ------------------------------------------------------------------ matrix

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A balanced design: every axis value appears (as near as possible) equally
 * often across the cast, and the axes are shuffled independently so the
 * combinations vary. Deterministic for a given set, so a re-run is stable.
 */
export function buildMatrix(axes: MatrixAxis[], size: number, seed: string): DesignMatrix {
  const rnd = seeded(seed);
  const columns = axes.map((a) => {
    const col: string[] = [];
    while (col.length < size) col.push(...a.values);
    col.length = size;
    for (let i = col.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [col[i], col[j]] = [col[j]!, col[i]!];
    }
    return col;
  });
  const cells = Array.from({ length: size }, (_, i) => ({
    slot: i + 1,
    cell: Object.fromEntries(axes.map((a, k) => [a.key, columns[k]![i]!])),
  }));
  return { axes, cells };
}

export function axesFor(p: PortfolioRow): MatrixAxis[] {
  const own = Array.isArray(p.matrix_axes) ? p.matrix_axes : [];
  // A portfolio axis with the same key replaces the common one.
  const keys = new Set(own.map((a) => a.key));
  return [...COMMON_AXES.filter((a) => !keys.has(a.key)), ...own];
}

// ------------------------------------------------------------------ schemas

const SkillSchema = z.object({
  code: z.string(),
  proficiency: z.number(),
  rationale: z.string(),
});

const PersonaOutSchema = z.object({
  slot: z.number(),
  name: z.string(),
  archetype: z.string(),
  career_route: z.string(),
  summary: z.string(),
  age_band: z.string(),
  formation: z.string(),
  prior_roles: z.array(z.string()),
  constituency: z.string(),
  political_capital: z.string(),
  network: z.string(),
  values: z.array(z.string()),
  signature_moves: z.array(z.string()),
  ocean: z.object({
    openness: z.number(),
    conscientiousness: z.number(),
    extraversion: z.number(),
    agreeableness: z.number(),
    neuroticism: z.number(),
  }),
  decision_style: z.object({
    horizon: z.number(),
    risk_posture: z.number(),
    evidence_weight: z.number(),
    consultation_breadth: z.number(),
    speed: z.number(),
    style: z.string(),
  }),
  skills: z.array(SkillSchema),
  proposed_skills: z.array(
    z.object({ label: z.string(), family: z.string(), definition: z.string() }),
  ),
  citations: z.array(z.object({ key: z.string(), why: z.string() })),
});
const BatchSchema = z.object({ personas: z.array(PersonaOutSchema) });

const DecisionSchema = z.object({
  key: z.string(),
  label: z.string(),
  weighs: z.array(z.string()),
  horizon: z.string(),
  risk_posture: z.string(),
  consults: z.array(z.string()),
  says_no_when: z.string(),
  narrative: z.string(),
});
const RangeSchema = z.object({ low: z.number(), high: z.number() });
const ProfileCore = {
  title: z.string(),
  summary: z.string(),
  ocean_target: z.object({
    openness: RangeSchema,
    conscientiousness: RangeSchema,
    extraversion: RangeSchema,
    agreeableness: RangeSchema,
    neuroticism: RangeSchema,
  }),
  traits: z.array(z.string()),
  values: z.array(z.string()),
  decision_model: z.array(DecisionSchema),
  skill_stack: z.array(
    z.object({
      code: z.string(),
      tier: z.enum(["must_have", "should_have", "differentiator"]),
      why: z.string(),
    }),
  ),
  anti_patterns: z.array(z.string()),
  stress_behaviours: z.array(z.string()),
  narrative_md: z.string(),
  citations: z.array(z.object({ key: z.string(), why: z.string() })),
};
const ProfileSchema = z.object(ProfileCore);
const PmProfileSchema = z.object({
  ...ProfileCore,
  portfolio_weighting: z.array(
    z.object({
      portfolio_code: z.string(),
      stance: z.string(),
      weight: z.number(),
      arbitration_rule: z.string(),
    }),
  ),
});
const OverlaySchema = z.object({
  ...ProfileCore,
  country_deltas: z.array(z.object({ aspect: z.string(), change: z.string(), why: z.string() })),
});

// ------------------------------------------------------------------ prompts

const PERSONA_SYSTEM = `You cast synthetic composite personas of ministers for GDPVision's Persona Lab, a decision instrument used by Caribbean governments.

Rules — follow every one:
- Each persona is a COMPOSITE: a plausible person built from the patterns in the context, never a real individual. Never use the name of a real politician, and never describe a career that would identify one. Invent ordinary Caribbean names that do not belong to any well-known public figure.
- Place each persona in a described, unnamed state ("a small OECS state of about 70,000 people", "a mid-sized CARICOM state with a large diaspora"). Never name a real country as the persona's own.
- Honour the persona's matrix cell exactly: its route to office, tenure, state scale, governing context, era, defining crisis and disposition (and any portfolio-specific axes) must all show in the persona.
- Ground every claim about what ministers in this office face in the CONTEXT lines and cite them by key in "citations". Do not cite lines you did not use. Do not invent statistics.
- Make each persona distinct from those already cast (listed by one-line digest). Different people, different strengths, different blind spots. Not all are admirable: some are weak in places, and their skills and proficiencies must say so honestly.
- Skills: choose 8 to 14 from the SKILL TAXONOMY by exact code, with a proficiency 1 (weak) to 5 (exceptional) and a one-line rationale tied to the persona's career. If the persona needs a skill the taxonomy lacks, put it in "proposed_skills" (family is one of: ${SKILL_FAMILIES.join(", ")}).
- OCEAN scores 0–100. Decision style dimensions 1–5: horizon (1 this term … 5 a generation), risk_posture (1 cautious … 5 bold), evidence_weight (1 instinct … 5 evidence first), consultation_breadth (1 tight circle … 5 wide), speed (1 deliberate … 5 fast); "style" is a short phrase.
- British/Caribbean spelling. Plain, specific prose. No promotional language.`;

const SYNTH_SYSTEM = `You synthesise an Ideal Minister Profile for GDPVision's Persona Lab: the person a Caribbean government should look for, develop or become for this office.

Rules — follow every one:
- Work from the AGGREGATES (counted from the cast, authoritative) and the CAST DIGESTS. Where the cast disagrees, say which pattern is associated with success in the CONTEXT and why.
- The ocean_target ranges must sit within the observed range of the cast unless you state in narrative_md why the ideal differs.
- decision_model: exactly one entry per DECISION CLASS, using its key and label. For each: what the ideal minister weighs, in order; their default horizon; their risk posture; who they consult; and when they say no.
- skill_stack: 12 to 18 skills by exact taxonomy code, tiered must_have / should_have / differentiator. Must-haves should be skills the aggregates rank highly, unless the context shows the most common skill is not what distinguishes success.
- anti_patterns: what goes wrong in this office. stress_behaviours: how the ideal minister behaves under pressure.
- narrative_md: 300–600 words, Markdown, no top-level headings, citing context keys inline in square brackets, e.g. [research.3].
- Cite every context line you relied on in "citations". Never invent a figure, a law, a name or an event.
- British/Caribbean spelling. Sober, specific. No promotional language.`;

function skillsBlock(skills: SkillRow[]): string {
  return `SKILL TAXONOMY (code | family | label)\n${skills.map((s) => `${s.code} | ${s.family} | ${s.label}`).join("\n")}`;
}

function contextBlock(lines: ContextLine[]): string {
  return `CONTEXT (key | text | source)\n${lines.map((l) => `${l.key} | ${l.text} | ${l.source.label}`).join("\n")}`;
}

function decisionBlock(p: PortfolioRow): string {
  return `DECISION CLASSES (key | label | description)\n${p.decision_classes
    .map((d) => `${d.key} | ${d.label} | ${d.description}`)
    .join("\n")}`;
}

function resolveCitations(
  lines: ContextLine[],
  cites: Array<{ key: string; why: string }>,
): Citation[] {
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of cites) {
    const l = byKey.get(c.key.trim());
    if (!l || seen.has(l.key)) continue;
    seen.add(l.key);
    out.push({ key: l.key, label: l.source.label, ref: l.source.ref, why: c.why });
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

// ------------------------------------------------------------------ phase work

interface Ctx {
  sb: AnyClient;
  set: SetRow;
  portfolio: PortfolioRow;
}

interface PhaseOutcome {
  next: Phase;
  summary: string;
  model?: string;
  patch?: Partial<SetRow>;
}

async function realHolders(sb: AnyClient, p: PortfolioRow, scope: string): Promise<RealHolder[]> {
  const { buildPortfolioPack } = await import("./context.server");
  return (await buildPortfolioPack(sb, p, scope, { research: false })).real;
}

function avoidList(real: RealHolder[]): string[] {
  const names = real
    .map((r) => r.name.replace(/^(the\s+)?(rt\.?\s+)?(hon\.?|dr\.?|sir|dame)\s+/gi, "").trim())
    .filter(Boolean);
  return [...new Set(names)].slice(0, 120);
}

async function phaseScope({ sb, set, portfolio }: Ctx): Promise<PhaseOutcome> {
  const { buildPortfolioPack } = await import("./context.server");
  const pack = await buildPortfolioPack(sb, portfolio, set.scope_key);
  const research = pack.lines.filter((l) => l.key.startsWith("research.")).length;
  const offices = pack.lines.filter((l) => l.key.startsWith("office.")).length;
  return {
    next: set.kind === "overlay" ? "overlay" : "matrix",
    summary: `${pack.lines.length} context lines: ${offices} office holders, ${research} cited research findings${pack.countries ? `, across ${pack.countries} countr${pack.countries === 1 ? "y" : "ies"}` : ""}.${pack.gaps.length ? ` Gaps: ${pack.gaps.join(" ")}` : ""}`,
    patch: { context: pack.lines, context_hash: pack.hash },
  };
}

async function phaseMatrix({ set, portfolio }: Ctx): Promise<PhaseOutcome> {
  const m =
    isMatrix(set.design_matrix) && set.design_matrix.cells.length === set.target_size
      ? set.design_matrix
      : buildMatrix(axesFor(portfolio), set.target_size, set.id);
  return {
    next: "generate",
    summary: `${m.cells.length} cells across ${m.axes.length} axes.`,
    patch: { design_matrix: m },
  };
}

async function writePersonas(
  ctx: Ctx,
  slots: number[],
  existing: PersonaRow[],
  skills: SkillRow[],
  retryNotes: Map<number, string[]> = new Map(),
  avoid: string[] = [],
): Promise<{ written: number; model: string; proposed: ProposedSkill[] }> {
  const { generateStructured } = await import("@/lib/sector/model.server");
  const { set, portfolio, sb } = ctx;
  const matrix = set.design_matrix as DesignMatrix;
  const cells = slots.map((s) => matrix.cells.find((c) => c.slot === s)!).filter(Boolean);
  const others = existing.filter((p) => !slots.includes(p.slot_index));
  const isPm = portfolio.kind === "head_of_government";
  const isOpposition = portfolio.kind === "opposition";

  const prompt = [
    `OFFICE: ${portfolio.label} — ${portfolio.description}`,
    isPm
      ? "This is the head of government. Each persona's career must explain how they reached the premiership, how they hold Cabinet together, and how they arbitrate between ministries when the fiscal envelope is fixed."
      : "",
    isOpposition
      ? "This is the Leader of the Opposition. Each persona's career must explain how they came to lead the opposition, how they hold the shadow Cabinet and party together, and how they balance scrutiny of the government with cooperation in the national interest. Write them without partisan colour: no real party, no position on a live controversy."
      : "",
    decisionBlock(portfolio),
    contextBlock(set.context),
    skillsBlock(skills),
    avoid.length
      ? `REAL OFFICE HOLDERS — never use these surnames, and never describe these people: ${avoid.join(", ")}`
      : "",
    `ALREADY CAST (do not repeat these people):\n${others.map(digest).join("\n") || "none yet"}`,
    `CAST NOW — one persona per cell, returning the same slot numbers:\n${cells
      .map(
        (c) =>
          `slot ${c.slot}: ${Object.entries(c.cell)
            .map(([k, v]) => `${k}=${v}`)
            .join(
              "; ",
            )}${retryNotes.get(c.slot)?.length ? `  [previous attempt rejected: ${retryNotes.get(c.slot)!.join(" ")}]` : ""}`,
      )
      .join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { out, model } = await generateStructured({
    schema: BatchSchema,
    system: PERSONA_SYSTEM,
    prompt,
    tag: `portfolio-personas:${portfolio.code}`,
    maxOutputTokens: 16000,
  });

  const valid = new Set(skills.map((s) => s.code));
  const proposed: ProposedSkill[] = [];
  const rows = out.personas
    .filter((p) => slots.includes(p.slot))
    // The model occasionally repeats a slot; one row per slot or the upsert fails.
    .filter((p, i, a) => a.findIndex((x) => x.slot === p.slot) === i)
    .map((p) => {
      const cell = cells.find((c) => c.slot === p.slot)!.cell;
      const skillsOut = p.skills
        .filter((s) => valid.has(s.code))
        .filter((s, i, a) => a.findIndex((x) => x.code === s.code) === i)
        .map((s) => ({
          code: s.code,
          proficiency: clamp(s.proficiency, 1, 5),
          rationale: s.rationale,
        }));
      for (const ps of p.proposed_skills) {
        const fam = (SKILL_FAMILIES as readonly string[]).includes(ps.family)
          ? ps.family
          : "domain";
        proposed.push({
          label: ps.label,
          family: fam as ProposedSkill["family"],
          definition: ps.definition,
          slots: [p.slot],
        });
      }
      const row = {
        set_id: set.id,
        scope_key: set.scope_key,
        slot_index: p.slot,
        matrix_cell: cell,
        name: p.name.trim(),
        archetype: p.archetype.trim(),
        career_route: p.career_route.trim(),
        summary: p.summary.trim(),
        attributes: {
          age_band: p.age_band,
          formation: p.formation,
          prior_roles: p.prior_roles,
          constituency: p.constituency,
          political_capital: p.political_capital,
          network: p.network,
          values: p.values,
          signature_moves: p.signature_moves,
        },
        ocean: Object.fromEntries(OCEAN_KEYS.map((k) => [k, clamp(p.ocean[k], 0, 100)])),
        decision_style: {
          ...Object.fromEntries(STYLE_KEYS.map((k) => [k, clamp(p.decision_style[k], 1, 5)])),
          style: p.decision_style.style,
        },
        skills: skillsOut,
        citations: resolveCitations(set.context, p.citations),
        qa: { retries: existing.find((e) => e.slot_index === p.slot)?.qa?.retries ?? 0 },
        normalized_key: normalizedKey({ career_route: p.career_route, archetype: p.archetype }),
        model,
      };
      return row;
    });
  if (!rows.length)
    throw new Error("The model returned no usable personas for this batch. Run again.");
  const { error } = await db(sb)
    .from("portfolio_personas")
    .upsert(rows, { onConflict: "set_id,slot_index" });
  if (error) throw new Error(error.message);
  return { written: rows.length, model, proposed };
}

function mergeProposed(prev: ProposedSkill[], add: ProposedSkill[]): ProposedSkill[] {
  const out = [...prev];
  for (const a of add) {
    const k = a.label.trim().toLowerCase();
    const hit = out.find((x) => x.label.trim().toLowerCase() === k);
    if (hit) hit.slots = [...new Set([...hit.slots, ...a.slots])];
    else out.push({ ...a });
  }
  return out.slice(0, 40);
}

async function phaseGenerate(ctx: Ctx): Promise<PhaseOutcome> {
  const { sb, set } = ctx;
  const [existing, skills, real] = await Promise.all([
    loadPersonas(sb, set.id),
    loadSkills(sb),
    realHolders(sb, ctx.portfolio, set.scope_key),
  ]);
  const have = new Set(existing.map((p) => p.slot_index));
  const missing = Array.from({ length: set.target_size }, (_, i) => i + 1).filter(
    (s) => !have.has(s),
  );
  if (!missing.length) return { next: "qa", summary: `${existing.length} personas cast.` };
  const batch = missing.slice(0, GENERATE_BATCH);
  const r = await writePersonas(ctx, batch, existing, skills, new Map(), avoidList(real));
  const total = existing.length + r.written;
  return {
    next: total >= set.target_size ? "qa" : "generate",
    summary: `Cast slots ${batch.join(", ")} (${total} of ${set.target_size}).`,
    model: r.model,
    patch: r.proposed.length
      ? { proposed_skills: mergeProposed(set.proposed_skills ?? [], r.proposed) }
      : undefined,
  };
}

async function phaseQa(ctx: Ctx): Promise<PhaseOutcome> {
  const { sb, set, portfolio } = ctx;
  const [personas, skills, real] = await Promise.all([
    loadPersonas(sb, set.id),
    loadSkills(sb),
    realHolders(sb, portfolio, set.scope_key),
  ]);
  const verdicts = checkPersonas(
    personas,
    real,
    thresholdsFor(portfolio.kind !== "ministry"),
    new Set(skills.map((s) => s.code)),
  );
  const c = db(sb);
  await Promise.all(
    verdicts.map((v) => {
      const p = personas.find((x) => x.slot_index === v.slot)!;
      return c
        .from("portfolio_personas")
        .update({
          qa: {
            ...p.qa,
            ok: v.ok,
            similarity: v.similarity,
            nearest_slot: v.nearest_slot,
            real_person_flag: v.real_person_flag,
            notes: v.notes,
          },
        })
        .eq("id", p.id);
    }),
  );
  const failing = verdicts.filter((v) => !v.ok);
  const retryable = failing.filter(
    (v) => (personas.find((p) => p.slot_index === v.slot)?.qa?.retries ?? 0) < MAX_RETRIES,
  );
  if (!retryable.length)
    return {
      next: "aggregate",
      summary: failing.length
        ? `${verdicts.length - failing.length} passed; ${failing.length} still flagged after ${MAX_RETRIES} retries and are left out of the count.`
        : `All ${verdicts.length} personas passed.`,
    };

  const slots = retryable.slice(0, GENERATE_BATCH).map((v) => v.slot);
  // Bump the retry count before regenerating, so a crash cannot loop forever.
  await Promise.all(
    slots.map((s) => {
      const p = personas.find((x) => x.slot_index === s)!;
      return c
        .from("portfolio_personas")
        .update({ qa: { ...p.qa, retries: (p.qa?.retries ?? 0) + 1 } })
        .eq("id", p.id);
    }),
  );
  const refreshed = await loadPersonas(sb, set.id);
  const notes = new Map(retryable.map((v) => [v.slot, v.notes]));
  const r = await writePersonas(ctx, slots, refreshed, skills, notes, avoidList(real));
  return {
    next: "qa",
    summary: `Regenerated slot${slots.length === 1 ? "" : "s"} ${slots.join(", ")} (${failing.length} flagged).`,
    model: r.model,
    patch: r.proposed.length
      ? { proposed_skills: mergeProposed(set.proposed_skills ?? [], r.proposed) }
      : undefined,
  };
}

export function countedPersonas(personas: PersonaRow[]): PersonaRow[] {
  return personas.filter((p) => (p.qa as { ok?: boolean })?.ok !== false);
}

async function upsertSynthesis(sb: AnyClient, set: SetRow, patch: Partial<SynthesisRow>) {
  const { error } = await db(sb)
    .from("portfolio_persona_syntheses")
    .upsert(
      { set_id: set.id, scope_key: set.scope_key, portfolio_code: set.portfolio_code, ...patch },
      { onConflict: "set_id" },
    );
  if (error) throw new Error(error.message);
}

async function phaseAggregate(ctx: Ctx): Promise<PhaseOutcome> {
  const { sb, set, portfolio } = ctx;
  const [personas, skills] = await Promise.all([loadPersonas(sb, set.id), loadSkills(sb)]);
  const counted = countedPersonas(personas);
  if (counted.length < Math.min(10, set.target_size))
    throw new Error(
      `Only ${counted.length} personas passed the quality check — too few to count. Regenerate the flagged slots.`,
    );
  const axes = isMatrix(set.design_matrix) ? set.design_matrix.axes : axesFor(portfolio);
  const aggregates = computeAggregates(counted, skills, axes);
  await upsertSynthesis(sb, set, { aggregates });
  return {
    next: "synthesise",
    summary: `Counted ${counted.length} personas: ${aggregates.skills.length} skills held; top: ${aggregates.skills
      .slice(0, 3)
      .map((s) => s.label)
      .join(", ")}.`,
  };
}

function aggregatesBlock(a: Aggregates): string {
  const ocean = OCEAN_KEYS.map(
    (k) =>
      `${k}: mean ${a.ocean[k].mean}, sd ${a.ocean[k].sd}, p25–p75 ${a.ocean[k].p25}–${a.ocean[k].p75}, range ${a.ocean[k].min}–${a.ocean[k].max}`,
  ).join("\n");
  const style = STYLE_KEYS.map((k) => `${k}: mean ${a.style[k].mean}, sd ${a.style[k].sd}`).join(
    "\n",
  );
  const skills = topSkills(a, 30)
    .map(
      (s) =>
        `${s.code} | ${s.label} | held by ${s.count}/${a.personas} | mean proficiency ${s.mean_proficiency} | weight ${s.weight}`,
    )
    .join("\n");
  const values = a.values
    .slice(0, 12)
    .map((v) => `${v.value} (${v.count})`)
    .join("; ");
  return `AGGREGATES (counted from ${a.personas} personas)\nOCEAN\n${ocean}\nDECISION STYLE (1–5)\n${style}\nSKILLS (top 30 by weight)\n${skills}\nVALUES most often named: ${values}`;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const cutList = (xs: string[], items: number, n: number) =>
  xs
    .map((x) => cut(String(x).trim(), n))
    .filter(Boolean)
    .slice(0, items);

/** Holds model output to the limits a person's edit is saved under (studio.functions ProfileIn). */
function normaliseProfile(
  out: z.infer<typeof ProfileSchema> & {
    portfolio_weighting?: IdealProfile["portfolio_weighting"];
    country_deltas?: IdealProfile["country_deltas"];
  },
  p: PortfolioRow,
  skills: SkillRow[],
): IdealProfile {
  const valid = new Set(skills.map((s) => s.code));
  const classes = new Map(p.decision_classes.map((d) => [d.key, d]));
  const decisions = out.decision_model
    .filter((d) => classes.has(d.key))
    .filter((d, i, a) => a.findIndex((x) => x.key === d.key) === i)
    .map((d) => ({ ...d, label: classes.get(d.key)!.label }));
  return {
    title: cut(out.title, 200),
    summary: cut(out.summary, 3000),
    personality: {
      ocean_target: Object.fromEntries(
        OCEAN_KEYS.map((k) => {
          const r = out.ocean_target[k];
          const lo = clamp(Math.min(r.low, r.high), 0, 100);
          const hi = clamp(Math.max(r.low, r.high), 0, 100);
          return [k, { low: lo, high: hi }];
        }),
      ) as IdealProfile["personality"]["ocean_target"],
      traits: cutList(out.traits, 20, 300),
    },
    values: cutList(out.values, 20, 200),
    decision_model: p.decision_classes
      .map((d) => decisions.find((x) => x.key === d.key))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({
        ...d,
        weighs: cutList(d.weighs, 12, 300),
        horizon: cut(d.horizon, 300),
        risk_posture: cut(d.risk_posture, 300),
        consults: cutList(d.consults, 12, 200),
        says_no_when: cut(d.says_no_when, 800),
        narrative: cut(d.narrative, 3000),
      })),
    skill_stack: out.skill_stack
      .filter((s) => valid.has(s.code))
      .filter((s, i, a) => a.findIndex((x) => x.code === s.code) === i)
      .slice(0, 30)
      .map((s) => ({ ...s, why: cut(s.why, 600) })),
    anti_patterns: cutList(out.anti_patterns, 15, 400),
    stress_behaviours: cutList(out.stress_behaviours, 15, 400),
    ...(out.portfolio_weighting
      ? {
          portfolio_weighting: out.portfolio_weighting.slice(0, 25).map((w) => ({
            ...w,
            stance: cut(w.stance, 600),
            arbitration_rule: cut(w.arbitration_rule, 800),
          })),
        }
      : {}),
    ...(out.country_deltas ? { country_deltas: out.country_deltas.slice(0, 20) } : {}),
  };
}

async function phaseSynthesise(ctx: Ctx): Promise<PhaseOutcome> {
  const { generateStructured } = await import("@/lib/sector/model.server");
  const { sb, set, portfolio } = ctx;
  const [personas, skills, synth] = await Promise.all([
    loadPersonas(sb, set.id),
    loadSkills(sb),
    loadSynthesis(sb, set.id),
  ]);
  const agg = synth?.aggregates;
  if (!agg || !("skills" in agg)) throw new Error("Count the cast before synthesising.");
  const a = agg as Aggregates;
  const isPm = portfolio.kind === "head_of_government";

  let inputs: Awaited<ReturnType<typeof loadPmInputs>> = [];
  if (isPm) {
    inputs = await loadPmInputs(sb, set.scope_key);
    if (inputs.length < PM_MIN_INPUTS)
      throw new Error(
        `The Prime Minister's profile is built from the approved profiles of the other portfolios. ${inputs.length} approved so far; approve at least ${PM_MIN_INPUTS} (the first wave: Finance, Tourism, Education, Health, Housing, Blue Economy) and run again.`,
      );
  }

  const cabinetBlock = isPm
    ? `CABINET — approved Ideal Minister Profiles for this scope (portfolio_code | title | summary | must-have skills | decisions)\n${inputs
        .map((x) => {
          const pr = x.synthesis.profile as IdealProfile;
          return `${x.portfolio.code} | ${pr.title} | ${pr.summary} | ${pr.skill_stack
            .filter((s) => s.tier === "must_have")
            .map((s) => s.code)
            .join(", ")} | ${pr.decision_model.map((d) => d.label).join("; ")}`;
        })
        .join(
          "\n",
        )}\n\nAlso return portfolio_weighting: one entry per portfolio above (portfolio_code exactly as given): the ideal Prime Minister's stance towards it, a weight 1–5 for how much of the PM's attention and political capital it commands, and the rule by which the PM arbitrates its claims against the others when the fiscal envelope is fixed.`
    : "";

  const prompt = [
    `OFFICE: ${portfolio.label} — ${portfolio.description}`,
    decisionBlock(portfolio),
    aggregatesBlock(a),
    `CAST DIGESTS\n${countedPersonas(personas).map(digest).join("\n")}`,
    cabinetBlock,
    contextBlock(set.context),
    skillsBlock(skills),
  ]
    .filter(Boolean)
    .join("\n\n");

  const { out, model } = await generateStructured({
    schema: (isPm ? PmProfileSchema : ProfileSchema) as unknown as z.ZodType<
      z.infer<typeof ProfileSchema> &
        Partial<Pick<z.infer<typeof PmProfileSchema>, "portfolio_weighting">>
    >,
    system: SYNTH_SYSTEM,
    prompt,
    tag: `portfolio-synthesis:${portfolio.code}`,
    maxOutputTokens: 14000,
  });

  const profile = normaliseProfile(out, portfolio, skills);
  if (isPm && profile.portfolio_weighting) {
    const codes = new Set(inputs.map((x) => x.portfolio.code));
    profile.portfolio_weighting = profile.portfolio_weighting
      .filter((w) => codes.has(w.portfolio_code))
      .map((w) => ({ ...w, weight: clamp(w.weight, 1, 5) }));
  }
  await upsertSynthesis(sb, set, {
    profile,
    narrative_md: out.narrative_md,
    citations: resolveCitations(set.context, out.citations),
    input_synthesis_ids: inputs.map((x) => x.synthesis.id),
    model,
  });
  return {
    next: "done",
    summary: `Profile written: ${profile.skill_stack.length} skills tiered, ${profile.decision_model.length} of ${portfolio.decision_classes.length} decision classes${isPm ? `, weighting across ${inputs.length} portfolios` : ""}.`,
    model,
  };
}

/** The approved regional set for a portfolio, if any. */
export async function currentRegionalSetId(
  sb: AnyClient,
  portfolioCode: string,
): Promise<string | null> {
  const { data } = await db(sb)
    .from("portfolio_persona_sets")
    .select("id")
    .eq("portfolio_code", portfolioCode)
    .eq("scope_key", REGIONAL)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1);
  return (data as Array<{ id: string }> | null)?.[0]?.id ?? null;
}

async function phaseOverlay(ctx: Ctx): Promise<PhaseOutcome> {
  const { generateStructured } = await import("@/lib/sector/model.server");
  const { sb, set, portfolio } = ctx;
  // Always re-weight the regional profile in force now, not the one that was
  // in force when the overlay was created.
  const baseSetId = (await currentRegionalSetId(sb, set.portfolio_code)) ?? set.base_set_id;
  if (!baseSetId) throw new Error("Approve the regional profile before running a country overlay.");
  const [base, skills] = await Promise.all([loadSynthesis(sb, baseSetId), loadSkills(sb)]);
  if (!base || !hasProfile(base.profile))
    throw new Error("The regional profile this overlay builds on has no synthesis.");
  const { data: country } = await db(sb)
    .from("countries")
    .select("name")
    .eq("code", set.scope_key)
    .maybeSingle();
  const cname = (country as { name?: string } | null)?.name ?? set.scope_key;
  const isPm = portfolio.kind === "head_of_government";

  const prompt = [
    `OFFICE: ${portfolio.label} in ${cname}.`,
    decisionBlock(portfolio),
    `REGIONAL IDEAL PROFILE (approved; the starting point)\n${JSON.stringify({ ...base.profile, narrative_md: base.narrative_md })}`,
    contextBlock(set.context),
    skillsBlock(skills),
    `Re-weight the regional profile for ${cname}. Keep what holds; change what this country's scale, economy, institutions, current office holders' situation and exposures require. Every change goes in country_deltas with the reason and must be supported by a cited CONTEXT line. Where the context is silent, keep the regional position.${isPm ? " Keep the regional portfolio_weighting in your reasoning, but do not return it." : ""}`,
  ].join("\n\n");

  const { out, model } = await generateStructured({
    schema: OverlaySchema,
    system: SYNTH_SYSTEM,
    prompt,
    tag: `portfolio-overlay:${portfolio.code}:${set.scope_key}`,
    maxOutputTokens: 14000,
  });
  const profile = normaliseProfile(out, portfolio, skills);
  const regional = base.profile as IdealProfile;
  if (isPm && regional.portfolio_weighting)
    profile.portfolio_weighting = regional.portfolio_weighting;
  await upsertSynthesis(sb, set, {
    aggregates: base.aggregates,
    profile,
    narrative_md: out.narrative_md,
    citations: [...resolveCitations(set.context, out.citations), ...(base.citations ?? [])].filter(
      (c, i, a) => a.findIndex((x) => x.key === c.key && x.ref === c.ref) === i,
    ),
    input_synthesis_ids: [base.id],
    model,
  });
  return {
    next: "done",
    summary: `${profile.country_deltas?.length ?? 0} country deltas from the regional profile.`,
    model,
    patch: baseSetId !== set.base_set_id ? { base_set_id: baseSetId } : undefined,
  };
}

const HANDLERS: Record<Exclude<Phase, "done">, (c: Ctx) => Promise<PhaseOutcome>> = {
  scope: phaseScope,
  matrix: phaseMatrix,
  generate: phaseGenerate,
  qa: phaseQa,
  aggregate: phaseAggregate,
  synthesise: phaseSynthesise,
  overlay: phaseOverlay,
};

// ------------------------------------------------------------------ tick

export interface TickResult {
  phase: Phase;
  run_state: SetRow["run_state"];
  summary: string;
  personas: number;
  target: number;
  busy?: boolean;
  error?: string;
}

export async function tick(sb: AnyClient, setId: string): Promise<TickResult> {
  const c = db(sb);
  const pre = await loadSet(sb, setId);
  const count = async () => {
    const { count: n } = await c
      .from("portfolio_personas")
      .select("id", { count: "exact", head: true })
      .eq("set_id", setId);
    return n ?? 0;
  };
  if (pre.status !== "draft" && pre.status !== "returned")
    throw new Error("This profile is under review or approved. Reopen it before running it again.");
  if (pre.phase === "done")
    return {
      phase: "done",
      run_state: "done",
      summary: "The run is complete.",
      personas: await count(),
      target: pre.target_size,
    };

  // Acquire the lock.
  const now = new Date();
  const { data: got, error: lockErr } = await c
    .from("portfolio_persona_sets")
    .update({
      run_state: "running",
      run_error: null,
      lock_until: new Date(now.getTime() + LOCK_SECONDS * 1000).toISOString(),
    })
    .eq("id", setId)
    .or(`lock_until.is.null,lock_until.lt.${now.toISOString()}`)
    .select("id");
  if (lockErr) throw new Error(lockErr.message);
  if (!got?.length)
    return {
      phase: pre.phase,
      run_state: "running",
      summary: "Another window is running this step. It will continue from there.",
      personas: await count(),
      target: pre.target_size,
      busy: true,
    };

  // Re-read under the lock: another window may have finished this phase
  // between our first read and taking the lock.
  const set = await loadSet(sb, setId);
  if (set.phase === "done") {
    await c
      .from("portfolio_persona_sets")
      .update({ lock_until: null, run_state: "done" })
      .eq("id", setId);
    return {
      phase: "done",
      run_state: "done",
      summary: "The run is complete.",
      personas: await count(),
      target: set.target_size,
    };
  }

  const portfolio = await loadPortfolio(sb, set.portfolio_code);
  const started = Date.now();
  const phase = set.phase as Exclude<Phase, "done">;
  const log = Array.isArray(set.phase_log) ? set.phase_log : [];
  try {
    if (!phasesFor(set.kind).includes(phase))
      throw new Error(`Phase ${phase} does not apply to this profile.`);
    const r = await HANDLERS[phase]({ sb, set, portfolio });
    const entry: PhaseLogEntry = {
      phase,
      state: "done",
      ts: new Date().toISOString(),
      duration_ms: Date.now() - started,
      model: r.model,
      summary: r.summary,
    };
    const done = r.next === "done";
    const { error } = await c
      .from("portfolio_persona_sets")
      .update({
        ...(r.patch ?? {}),
        phase: r.next,
        run_state: done ? "done" : "idle",
        lock_until: null,
        run_error: null,
        model: r.model ?? set.model,
        phase_log: [...log, entry].slice(-120),
      })
      .eq("id", setId);
    if (error) throw new Error(error.message);
    return {
      phase: r.next,
      run_state: done ? "done" : "idle",
      summary: r.summary,
      personas: await count(),
      target: set.target_size,
    };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    await c
      .from("portfolio_persona_sets")
      .update({
        run_state: "failed",
        lock_until: null,
        run_error: msg.slice(0, 600),
        phase_log: [
          ...log,
          {
            phase,
            state: "failed",
            ts: new Date().toISOString(),
            duration_ms: Date.now() - started,
            error: msg.slice(0, 300),
          },
        ].slice(-120),
      })
      .eq("id", setId);
    return {
      phase,
      run_state: "failed",
      summary: msg,
      personas: await count(),
      target: set.target_size,
      error: msg,
    };
  }
}

/** The approved profile in force for a portfolio in a country: overlay, else regional. */
export async function effectiveProfile(
  sb: AnyClient,
  country: string,
  portfolioCode: string,
  opts: { allowDraft?: boolean } = {},
): Promise<{ set: SetRow; synthesis: SynthesisRow; approved: boolean } | null> {
  const c = db(sb);
  for (const scope of [country, REGIONAL]) {
    const { data } = await c
      .from("portfolio_persona_sets")
      .select(SET_COLS)
      .eq("portfolio_code", portfolioCode)
      .eq("scope_key", scope)
      .order("version", { ascending: false })
      .limit(10);
    const sets = (data ?? []) as SetRow[];
    const pick =
      sets.find((s) => s.status === "approved") ??
      (opts.allowDraft ? sets.find((s) => s.phase === "done") : undefined);
    if (!pick) continue;
    const synthesis = await loadSynthesis(sb, pick.id);
    if (synthesis && hasProfile(synthesis.profile))
      return { set: pick, synthesis, approved: pick.status === "approved" };
  }
  return null;
}
