// @domain personas
// @tables persona_projects,programme_plans,programme_phases,programme_milestones,programme_deliverables
// @ui src/components/personas/field/PlanProposalReview.tsx; src/routes/_authenticated/admin/countries.$code.personas.programme.tsx

// Chamber 07 · Programme planner — the AI-first, brief-derived engine for the
// real-world research track.
//
// Nothing about the shape of a programme is hardcoded. The brief is the only
// input: the model infers objectives, span, phase structure, milestones,
// deliverables, method mix, audience and risks, and returns each with a
// rationale. Offsets are returned in days relative to programme start, so a
// two-week pulse and a nine-month panel use exactly the same pipeline.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { deriveJson } from "./field-ai.server";

// ── Proposal shape (all values derived, none assumed) ──────────────────────

export interface PlanProposal {
  summary: string;
  duration_days: number;
  duration_rationale: string;
  objectives: Array<{ objective: string; why: string }>;
  phases: Array<{
    name: string;
    intent: string;
    start_offset_days: number;
    end_offset_days: number;
  }>;
  milestones: Array<{
    title: string;
    detail?: string;
    phase: string;
    owner?: string;
    start_offset_days?: number;
    due_offset_days: number;
  }>;
  deliverables: Array<{
    title: string;
    kind?: string;
    detail?: string;
    owner?: string;
    milestone?: string;
    due_offset_days: number;
  }>;
  method_mix: Array<{
    method: string;
    objective: string;
    rationale: string;
    audience: string;
    sample_size?: number | string;
    instrument?: string;
  }>;
  audience: Array<{
    segment: string;
    why: string;
    target_n?: number | string;
    recruitment_difficulty?: string;
  }>;
  risks: Array<{ risk: string; mitigation: string; severity?: string }>;
}

// A name is only a name when it says something about THIS programme. Generic
// lifecycle boilerplate ("Phase 1", "TBD", "Untitled") is treated as a missing
// name so the derivation retries rather than persisting an anonymous phase.
const GENERIC_NAME =
  /^(untitled|tbd|to be decided|n\/?a|none|phase\s*\d+|stage\s*\d+|step\s*\d+|part\s*\d+|phase|stage|milestone\s*\d+)\W*$/i;

export function isNamed(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = value.trim();
  return t.length >= 3 && !GENERIC_NAME.test(t);
}

function isProposal(v: unknown): v is PlanProposal {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<PlanProposal>;
  if (
    typeof p.summary !== "string" ||
    typeof p.duration_days !== "number" ||
    p.duration_days <= 0 ||
    !Array.isArray(p.phases) ||
    p.phases.length === 0 ||
    !Array.isArray(p.milestones) ||
    p.milestones.length === 0 ||
    !Array.isArray(p.method_mix)
  ) {
    return false;
  }
  // Every phase must carry a specific, non-repeating name and an intent.
  const seen = new Set<string>();
  for (const ph of p.phases) {
    if (!isNamed(ph?.name)) return false;
    if (typeof ph.intent !== "string" || ph.intent.trim().length < 8) return false;
    const key = ph.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  // Milestones must be named too, and bound to a real phase.
  const phaseNames = new Set(p.phases.map((ph) => ph.name.trim().toLowerCase()));
  for (const m of p.milestones) {
    if (!isNamed(m?.title)) return false;
    if (typeof m.phase !== "string" || !phaseNames.has(m.phase.trim().toLowerCase())) return false;
  }
  return true;
}

// ── Prompt ─────────────────────────────────────────────────────────────────

const PLANNER_SYSTEM = `You are a senior research director at a top-tier strategy firm, designing a real-world (non-synthetic) research programme for a sovereign government client.

You have NO templates. Every programme you design is derived entirely from the brief in front of you. Do not reach for a default number of weeks, a default set of phase names, or a default mix of surveys and focus groups. A brief may call for a two-week rapid pulse, a nine-month longitudinal panel, a single expert roundtable, a nationwide quantitative wave, an ethnographic diary study, or a combination nobody has run before. Design what THIS brief actually requires.

Rules:
- Derive duration from the brief's stated deadline, scope, audience difficulty and urgency. If the brief names a deadline, size the work to land before it. If it does not, propose a defensible span and justify it.
- NAMING IS NOT OPTIONAL. Every phase carries a specific, substantive name drawn from this brief's subject matter, sector and the client's own language — e.g. "Diaspora Trust Baseline", "Agent Network Diagnostic", "Cabinet Read-out & Advisory". Never "Phase 1", "Stage 2", "Fieldwork", "Untitled", "TBD" or any lifecycle boilerplate that would fit any programme. No two phases may share a name. Each phase also carries a one-sentence intent. The same standard applies to milestone titles and deliverable titles.
- Use as many or as few phases as the work genuinely needs.
- Every milestone and deliverable must be one this brief genuinely implies.
- Choose methods per objective and justify each choice. Never list a method you cannot tie to an objective.
- Express all timing as integer day offsets from programme start (day 0). Offsets must be internally consistent and non-decreasing within a phase.
- Every milestone's "phase" must exactly match one of your phase names. Every deliverable's "milestone", if set, must exactly match one of your milestone titles.`;

function plannerUser(args: {
  countryName: string;
  countryCode: string;
  title: string;
  briefText: string;
  scope: unknown;
  constraints: { deadline?: string | null; startsOn?: string | null; notes?: string | null };
  steering?: string | null;
}): string {
  return `PROGRAMME TITLE: ${args.title}
COUNTRY: ${args.countryName} (${args.countryCode})
${args.constraints.startsOn ? `EARLIEST START: ${args.constraints.startsOn}` : ""}
${args.constraints.deadline ? `HARD DEADLINE: ${args.constraints.deadline}` : "NO DEADLINE STATED — you must propose and justify the span."}
${args.constraints.notes ? `CLIENT CONSTRAINTS: ${args.constraints.notes}` : ""}
${args.steering ? `\nSTEERING FROM THE CLIENT ON A PREVIOUS DRAFT (address this directly):\n${args.steering}` : ""}

RAW BRIEF:
${args.briefText.slice(0, 24_000)}

${args.scope ? `STRUCTURED SCOPE ALREADY EXTRACTED FROM THIS BRIEF:\n${JSON.stringify(args.scope).slice(0, 6_000)}` : ""}

Return JSON:
{
  "summary": "2-4 sentence description of the programme you are proposing",
  "duration_days": 0,
  "duration_rationale": "why this span, tied to the brief",
  "objectives": [{"objective":"...","why":"..."}],
  "phases": [{"name":"...","intent":"...","start_offset_days":0,"end_offset_days":0}],
  "milestones": [{"title":"...","detail":"...","phase":"<exact phase name>","owner":"role","start_offset_days":0,"due_offset_days":0}],
  "deliverables": [{"title":"...","kind":"screener|guide|questionnaire|topline|report|presentation|other","detail":"...","owner":"role","milestone":"<exact milestone title>","due_offset_days":0}],
  "method_mix": [{"method":"survey|focus_group|depth_interview|expert_panel|diary|observational|desk_research|other","objective":"which objective it serves","rationale":"why this method","audience":"who","sample_size":0,"instrument":"what instrument is needed"}],
  "audience": [{"segment":"...","why":"...","target_n":0,"recruitment_difficulty":"low|medium|high"}],
  "risks": [{"risk":"...","mitigation":"...","severity":"low|medium|high"}]
}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Resolve the programme start: explicit start, or deadline minus span. */
function resolveStart(
  startsOn: string | null | undefined,
  deadline: string | null | undefined,
  durationDays: number,
): string {
  if (startsOn) return startsOn;
  if (deadline) {
    const back = addDays(deadline, -durationDays);
    return back > todayIso() ? back : todayIso();
  }
  return todayIso();
}

type BriefRow = {
  id: string;
  title: string;
  country_code: string;
  brief_raw: string | null;
  brief_scope: Json | null;
  brief_uploads: Json | null;
  brief_source: Json | null;
  brief_committed_at: string | null;
};

type UploadLike = { name?: string; mime?: string; excerpt?: string };

/**
 * The planner reads brief-first. The governing Source Brief is labelled as
 * authoritative; supporting context may qualify it but never overrides it.
 */
function briefText(row: BriefRow): string {
  const parts: string[] = [];

  const source = (row.brief_source ?? null) as UploadLike | null;
  if (source?.excerpt && source.excerpt.trim()) {
    parts.push(
      `=== GOVERNING SOURCE BRIEF (authoritative) — ${source.name ?? "brief document"} ===\n${source.excerpt.trim()}`,
    );
  }

  const raw = (row.brief_raw ?? "").trim();
  if (raw) {
    parts.push(`=== BRIEF AS WRITTEN / CONFIRMED BY THE CLIENT (authoritative) ===\n${raw}`);
  }

  const uploads = Array.isArray(row.brief_uploads)
    ? (row.brief_uploads as unknown as UploadLike[])
    : [];
  for (const u of uploads) {
    if (!u?.excerpt || !u.excerpt.trim()) continue;
    if (source?.name && u.name === source.name) continue;
    parts.push(
      `=== SUPPORTING CONTEXT (qualifies the brief; never overrides it) — ${u.name ?? "document"} ===\n${u.excerpt.trim()}`,
    );
  }

  return parts.join("\n\n").trim();
}

// ── Naming repair pass ─────────────────────────────────────────────────────
// If both models return a plan with anonymous, duplicate or boilerplate phase
// names, we do not persist it. One naming-only call re-titles the phases from
// the brief; if that also fails, the name falls back to the phase's own intent
// so a generic placeholder never reaches the database.

function isLoosePlan(v: unknown): v is PlanProposal {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<PlanProposal>;
  return (
    typeof p.summary === "string" &&
    typeof p.duration_days === "number" &&
    p.duration_days > 0 &&
    Array.isArray(p.phases) &&
    p.phases.length > 0 &&
    Array.isArray(p.milestones) &&
    Array.isArray(p.method_mix)
  );
}

function firstSentence(s: string, max = 60): string {
  const t = s.trim().replace(/\s+/g, " ");
  const cut = t.split(/[.;—]/)[0] ?? t;
  return (cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut) || t.slice(0, max);
}

async function repairPhaseNames(plan: PlanProposal, briefBody: string): Promise<PlanProposal> {
  const bad = plan.phases.some((p, i) => {
    if (!isNamed(p?.name)) return true;
    return plan.phases.findIndex((q) => q.name?.trim().toLowerCase() === p.name.trim().toLowerCase()) !== i;
  });
  if (!bad) return plan;

  let named: Array<{ index: number; name: string }> = [];
  try {
    const res = await deriveJson<{ phases: Array<{ index: number; name: string }> }>({
      system:
        "You name research programme phases. Each name is specific to the brief's subject, sector and client language, at most six words, never lifecycle boilerplate ('Phase 1', 'Fieldwork', 'Analysis'), and never repeated. Return JSON only.",
      user: `BRIEF (extract):\n${briefBody.slice(0, 8_000)}\n\nPHASES TO NAME (index · current name · intent):\n${plan.phases
        .map((p, i) => `${i} · ${p.name ?? "(unnamed)"} · ${p.intent ?? ""}`)
        .join("\n")}\n\nReturn: {"phases":[{"index":0,"name":"..."}]}`,
      validate: (v): v is { phases: Array<{ index: number; name: string }> } =>
        !!v &&
        typeof v === "object" &&
        Array.isArray((v as { phases?: unknown }).phases) &&
        (v as { phases: Array<{ name?: unknown }> }).phases.every((p) => isNamed(p?.name)),
    });
    named = res.phases;
  } catch {
    /* fall through to intent-derived names */
  }

  const used = new Set<string>();
  const phases = plan.phases.map((p, i) => {
    const proposed = named.find((n) => n.index === i)?.name?.trim();
    let name = isNamed(proposed) ? (proposed as string) : isNamed(p.name) ? p.name.trim() : "";
    if (!name) name = firstSentence(p.intent ?? "") || `${plan.summary ? firstSentence(plan.summary, 40) : "Programme"} · part ${i + 1}`;
    let key = name.toLowerCase();
    if (used.has(key)) {
      name = `${name} · ${i + 1}`;
      key = name.toLowerCase();
    }
    used.add(key);
    return { ...p, name };
  });

  // Re-point milestones whose phase reference no longer resolves.
  const validNames = new Set(phases.map((p) => p.name.toLowerCase()));
  const oldToNew = new Map(plan.phases.map((p, i) => [(p.name ?? "").trim().toLowerCase(), phases[i].name]));
  const milestones = (plan.milestones ?? []).map((m) => {
    const ref = (m.phase ?? "").trim().toLowerCase();
    if (validNames.has(ref)) return m;
    return { ...m, phase: oldToNew.get(ref) ?? phases[0].name };
  });

  return { ...plan, phases, milestones };
}

// ── Derive a plan proposal ─────────────────────────────────────────────────

const DeriveInput = z.object({
  projectId: z.string().uuid(),
  startsOn: z.string().date().nullish(),
  deadline: z.string().date().nullish(),
  constraints: z.string().max(4_000).nullish(),
  steering: z.string().max(4_000).nullish(),
});

export const deriveProgrammePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeriveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("persona_projects")
      .select(
        "id,title,country_code,brief_raw,brief_scope,brief_uploads,brief_source,brief_committed_at",
      )
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research program not found");
    const project = row as unknown as BriefRow;

    const text = briefText(project);
    if (text.length < 40) {
      throw new Error(
        "The brief is too thin to plan from — add detail or attach the brief document first.",
      );
    }

    const { data: country } = await supabase
      .from("countries")
      .select("name")
      .eq("code", project.country_code)
      .maybeSingle();

    const userPrompt = plannerUser({
      countryName: (country?.name as string) ?? project.country_code,
      countryCode: project.country_code,
      title: project.title,
      briefText: text,
      scope: project.brief_scope,
      constraints: {
        deadline: data.deadline ?? null,
        startsOn: data.startsOn ?? null,
        notes: data.constraints ?? null,
      },
      steering: data.steering ?? null,
    });

    // Strict first: a plan with anonymous or duplicate phase names is rejected
    // and re-derived. Only if both models fail the strict bar do we accept a
    // looser plan and repair the naming before anything is persisted.
    let proposal: PlanProposal;
    try {
      proposal = await deriveJson<PlanProposal>({
        system: PLANNER_SYSTEM,
        user: userPrompt,
        validate: isProposal,
      });
    } catch {
      const loose = await deriveJson<PlanProposal>({
        system: PLANNER_SYSTEM,
        user: userPrompt,
        validate: isLoosePlan,
      });
      proposal = await repairPhaseNames(loose, text);
    }

    const startsOn = resolveStart(data.startsOn, data.deadline, proposal.duration_days);
    const endsOn = addDays(startsOn, proposal.duration_days);

    // Next version number for this project.
    const { data: prev } = await supabase
      .from("programme_plans")
      .select("version")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    const version = ((prev?.[0]?.version as number | undefined) ?? 0) + 1;

    const { data: plan, error: insErr } = await supabase
      .from("programme_plans")
      .insert({
        project_id: data.projectId,
        country_code: project.country_code,
        version,
        status: "proposed",
        starts_on: startsOn,
        ends_on: endsOn,
        summary: proposal.summary,
        objectives: proposal.objectives as unknown as Json,
        method_mix: proposal.method_mix as unknown as Json,
        audience: proposal.audience as unknown as Json,
        risks: proposal.risks as unknown as Json,
        rationale: { duration: proposal.duration_rationale } as unknown as Json,
        raw_proposal: proposal as unknown as Json,
        visibility: "private",
        owner_country_code: project.country_code,
        uploaded_by: userId,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const planId = plan.id as string;

    // Phases
    const phaseIdByName = new Map<string, string>();
    for (const [i, p] of proposal.phases.entries()) {
      const { data: pr } = await supabase
        .from("programme_phases")
        .insert({
          plan_id: planId,
          country_code: project.country_code,
          name: p.name,
          intent: p.intent,
          position: i,
          starts_on: addDays(startsOn, p.start_offset_days ?? 0),
          ends_on: addDays(startsOn, p.end_offset_days ?? p.start_offset_days ?? 0),
        } as never)
        .select("id")
        .single();
      if (pr?.id) phaseIdByName.set(p.name, pr.id as string);
    }

    // Milestones
    const milestoneIdByTitle = new Map<string, string>();
    for (const [i, m] of proposal.milestones.entries()) {
      const { data: mr } = await supabase
        .from("programme_milestones")
        .insert({
          plan_id: planId,
          phase_id: phaseIdByName.get(m.phase) ?? null,
          country_code: project.country_code,
          title: m.title,
          detail: m.detail ?? null,
          owner: m.owner ?? null,
          starts_on: m.start_offset_days != null ? addDays(startsOn, m.start_offset_days) : null,
          due_on: addDays(startsOn, m.due_offset_days ?? 0),
          status: "planned",
          position: i,
        } as never)
        .select("id")
        .single();
      if (mr?.id) milestoneIdByTitle.set(m.title, mr.id as string);
    }

    // Deliverables
    for (const [i, d] of (proposal.deliverables ?? []).entries()) {
      await supabase.from("programme_deliverables").insert({
        plan_id: planId,
        milestone_id: d.milestone ? (milestoneIdByTitle.get(d.milestone) ?? null) : null,
        country_code: project.country_code,
        title: d.title,
        kind: d.kind ?? null,
        detail: d.detail ?? null,
        owner: d.owner ?? null,
        due_on: addDays(startsOn, d.due_offset_days ?? 0),
        status: "planned",
        position: i,
      } as never);
    }

    return { planId, version, startsOn, endsOn };
  });

// ── Read the active plan (committed if any, else latest proposal) ──────────

export const getProgrammePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), planId: z.string().uuid().nullish() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("programme_plans")
      .select("*")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1);
    if (data.planId) {
      query = supabase.from("programme_plans").select("*").eq("id", data.planId).limit(1);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const plan = rows?.[0];
    if (!plan) return null;

    const planId = plan.id as string;
    const [{ data: phases }, { data: milestones }, { data: deliverables }, { data: versions }] =
      await Promise.all([
        supabase.from("programme_phases").select("*").eq("plan_id", planId).order("position"),
        supabase.from("programme_milestones").select("*").eq("plan_id", planId).order("due_on"),
        supabase.from("programme_deliverables").select("*").eq("plan_id", planId).order("due_on"),
        supabase
          .from("programme_plans")
          .select("id,version,status,created_at")
          .eq("project_id", data.projectId)
          .order("version", { ascending: false }),
      ]);

    return {
      plan,
      phases: phases ?? [],
      milestones: milestones ?? [],
      deliverables: deliverables ?? [],
      versions: versions ?? [],
    };
  });

// ── Commit ─────────────────────────────────────────────────────────────────

export const commitProgrammePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: plan, error } = await supabase
      .from("programme_plans")
      .select("*")
      .eq("id", data.planId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Plan not found");

    // Only one active plan per programme.
    await supabase
      .from("programme_plans")
      .update({ status: "superseded" } as never)
      .eq("project_id", plan.project_id as string)
      .eq("status", "active");

    const { error: updErr } = await supabase
      .from("programme_plans")
      .update({ status: "active", committed_at: new Date().toISOString() } as never)
      .eq("id", data.planId);
    if (updErr) throw new Error(updErr.message);

    // Archive the approved programme into the country's second brain so any
    // chamber can cite it. Idempotent — a re-approval updates in place.
    let filed = false;
    try {
      const [{ data: phases }, { data: milestones }, { data: deliverables }, { data: project }] =
        await Promise.all([
          supabase
            .from("programme_phases")
            .select("name,intent,starts_on,ends_on")
            .eq("plan_id", data.planId)
            .order("position"),
          supabase
            .from("programme_milestones")
            .select("title,detail,owner,due_on")
            .eq("plan_id", data.planId)
            .order("due_on"),
          supabase
            .from("programme_deliverables")
            .select("title,kind,owner,due_on")
            .eq("plan_id", data.planId)
            .order("due_on"),
          supabase
            .from("persona_projects")
            .select("title")
            .eq("id", plan.project_id as string)
            .maybeSingle(),
        ]);

      const { ingestProgrammePlanToCorpus } = await import("./field-corpus.server");
      await ingestProgrammePlanToCorpus({
        countryCode: plan.country_code as string,
        projectId: plan.project_id as string,
        projectTitle: (project?.title as string | undefined) ?? "Research programme",
        planId: data.planId,
        version: (plan.version as number | undefined) ?? 1,
        startsOn: (plan.starts_on as string | null) ?? null,
        endsOn: (plan.ends_on as string | null) ?? null,
        summary: (plan.summary as string | null) ?? null,
        objectives: plan.objectives ?? null,
        methodMix: plan.method_mix ?? null,
        audience: plan.audience ?? null,
        risks: plan.risks ?? null,
        rationale: plan.rationale ?? null,
        phases: (phases ?? []) as never,
        milestones: (milestones ?? []) as never,
        deliverables: (deliverables ?? []) as never,
      });
      filed = true;
    } catch {
      // Approval must not fail because the corpus write did.
    }

    return { ok: true as const, filedToCorpus: filed };
  });

export const discardProgrammePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("programme_plans")
      .delete()
      .eq("id", data.planId)
      .eq("status", "proposed");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
