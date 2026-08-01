// @domain personas
// @tables studies,field_responses,field_sessions,field_instruments,memory_objects
// @ui src/components/personas/field/FieldSynthesis.tsx

// Chamber 07 · Field synthesis — reads REAL responses, transcripts and notes
// and produces toplines, segment cuts, verbatims and a confidence note. Real
// and synthetic evidence are never blended silently: the output is labelled,
// and the calibration view sets one against the other explicitly.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { deriveJson } from "./field-ai.server";

export interface FieldFinding {
  headline: string;
  toplines: Array<{ finding: string; evidence: string; strength?: string }>;
  segments: Array<{ segment: string; observation: string }>;
  quotes: Array<{ quote: string; participant: string; context?: string }>;
  tensions: string[];
  implications: string[];
  confidence: { level: string; why: string; limitations: string[] };
}

function isFinding(v: unknown): v is FieldFinding {
  const f = v as Partial<FieldFinding> | null;
  return (
    !!f &&
    typeof f.headline === "string" &&
    Array.isArray(f.toplines) &&
    f.toplines.length > 0 &&
    !!f.confidence &&
    typeof f.confidence.level === "string"
  );
}

export const synthesiseField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: study, error } = await supabase
      .from("studies")
      .select("id,title,objective,method,country_code,project_id,config")
      .eq("id", data.studyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!study) throw new Error("Study not found");

    const [{ data: instrument }, { data: responses }, { data: sessions }] = await Promise.all([
      supabase
        .from("field_instruments")
        .select("questions")
        .eq("study_id", data.studyId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("field_responses")
        .select("participant_code,answers,submitted_at")
        .eq("study_id", data.studyId)
        .limit(1_000),
      supabase
        .from("field_sessions")
        .select("title,method,scheduled_at,transcript,notes")
        .eq("study_id", data.studyId)
        .not("transcript", "is", null),
    ]);

    const responseCount = responses?.length ?? 0;
    const sessionCount = sessions?.length ?? 0;
    if (responseCount === 0 && sessionCount === 0) {
      throw new Error("Nothing to synthesise yet — collect responses or attach a transcript first.");
    }

    const instrumentBlock = instrument?.questions
      ? `INSTRUMENT:\n${JSON.stringify(instrument.questions).slice(0, 8_000)}`
      : "";
    const responseBlock =
      responseCount > 0
        ? `RESPONSES (${responseCount}, pseudonymous):\n${JSON.stringify(responses).slice(0, 60_000)}`
        : "";
    const sessionBlock =
      sessionCount > 0
        ? `SESSION TRANSCRIPTS (${sessionCount}):\n${(sessions ?? [])
            .map(
              (s) =>
                `\n--- ${s.title} (${s.method}, ${s.scheduled_at ?? "date not set"}) ---\n${(s.transcript as string).slice(0, 40_000)}\n${s.notes ? `MODERATOR NOTES: ${s.notes}` : ""}`,
            )
            .join("\n")
            .slice(0, 120_000)}`
        : "";

    const system = `You are a senior qualitative and quantitative research analyst synthesising REAL fieldwork for a sovereign government client.

Rules you must not break:
- Every finding must be grounded in the material provided. Do not infer beyond it, do not import outside knowledge as if it were evidence, and do not invent quotes.
- Attribute quotes only by the pseudonymous participant code given. Never guess or state a real name.
- Be explicit and honest about limitations: small base sizes, self-selection, single-session evidence, unbalanced segments.
- Where the evidence is thin or contradictory, say so rather than smoothing it over.`;

    const user = `STUDY: ${study.title}
OBJECTIVE: ${study.objective ?? "(not stated)"}
METHOD: ${study.method ?? "field"}
COUNTRY: ${study.country_code}
BASE: ${responseCount} responses, ${sessionCount} sessions

${instrumentBlock}

${responseBlock}

${sessionBlock}

Return JSON:
{
  "headline": "the single most important thing this fieldwork found",
  "toplines": [{"finding":"...","evidence":"the specific numbers or passages behind it","strength":"strong|moderate|indicative"}],
  "segments": [{"segment":"...","observation":"how this group differs"}],
  "quotes": [{"quote":"verbatim","participant":"P-0001","context":"why it matters"}],
  "tensions": ["contradictions or disagreements in the evidence"],
  "implications": ["what the client should do or decide as a result"],
  "confidence": {"level":"high|moderate|low","why":"...","limitations":["..."]}
}`;

    const finding = await deriveJson<FieldFinding>({ system, user, validate: isFinding });

    const config = (study.config as Record<string, unknown> | null) ?? {};
    const { error: updErr } = await supabase
      .from("studies")
      .update({
        status: "synthesized",
        config: {
          ...config,
          field_finding: finding,
          field_synthesised_at: new Date().toISOString(),
          field_base: { responses: responseCount, sessions: sessionCount },
        } as unknown as Json,
      } as never)
      .eq("id", data.studyId);
    if (updErr) throw new Error(updErr.message);

    const { buildFieldTag, ingestFindingToCorpus } = await import("./field-corpus.server");
    const tag = await buildFieldTag(data.studyId);
    const mem = await ingestFindingToCorpus({
      tag,
      scope: "study",
      title: `Field finding · ${study.title}`,
      finding,
    });

    return { finding, memoryId: mem?.id ?? null, base: { responseCount, sessionCount } };
  });

/**
 * Set a field study against a synthetic study that answered the same
 * objective. This is the lab's calibration signal — how well did the
 * synthetic public predict the real one?
 */
export const compareToSynthetic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ fieldStudyId: z.string().uuid(), syntheticStudyId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("studies")
      .select("id,title,objective,mode,config")
      .in("id", [data.fieldStudyId, data.syntheticStudyId]);
    if (error) throw new Error(error.message);

    const field = rows?.find((r) => r.id === data.fieldStudyId);
    const synthetic = rows?.find((r) => r.id === data.syntheticStudyId);
    if (!field || !synthetic) throw new Error("Both studies must exist");

    const fieldFinding = (field.config as Record<string, unknown> | null)?.field_finding;
    if (!fieldFinding) throw new Error("Run field synthesis before comparing.");

    const system = `You are calibrating a synthetic-public simulation against real-world fieldwork. Report where the simulation was right, where it was wrong, and by how much. Be blunt — the value of this comparison is its honesty. Never invent numbers that are not in either input.`;

    const user = `SHARED OBJECTIVE: ${field.objective ?? synthetic.objective ?? "(not stated)"}

SYNTHETIC STUDY OUTPUT (${synthetic.title}):
${JSON.stringify(synthetic.config ?? {}).slice(0, 30_000)}

REAL FIELD FINDING (${field.title}):
${JSON.stringify(fieldFinding).slice(0, 30_000)}

Return JSON:
{
  "verdict": "one sentence on how well the synthetic public predicted the real one",
  "deltas": [{"question":"what was being predicted","synthetic":"what the simulation said","field":"what real people said","gap":"the size and direction of the miss"}],
  "where_synthetic_held": ["..."],
  "where_synthetic_failed": ["..."],
  "calibration_actions": ["how to improve the synthetic model next time"]
}`;

    type Calibration = { verdict: string; deltas: Json[] };
    const comparison = await deriveJson<Calibration>({
      system,
      user,
      validate: (v): v is Calibration => {
        const c = v as { verdict?: unknown; deltas?: unknown } | null;
        return !!c && typeof c.verdict === "string" && Array.isArray(c.deltas);
      },
    });

    const config = (field.config as Record<string, unknown> | null) ?? {};
    await supabase
      .from("studies")
      .update({
        config: {
          ...config,
          calibration: { against: data.syntheticStudyId, ...comparison, at: new Date().toISOString() },
        } as unknown as Json,
      } as never)
      .eq("id", data.fieldStudyId);

    return comparison;
  });

/** Close the programme: one memo, written to the corpus, over every study. */
export const closeProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project } = await supabase
      .from("persona_projects")
      .select("id,title,country_code,brief_scope")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Research program not found");

    const { data: studies } = await supabase
      .from("studies")
      .select("id,title,mode,method,objective,config")
      .eq("project_id", data.projectId);
    const withFindings = (studies ?? []).filter(
      (s) => (s.config as Record<string, unknown> | null)?.field_finding,
    );
    if (withFindings.length === 0) {
      throw new Error("No synthesised field studies yet — synthesise at least one before closing.");
    }

    const system = `You are writing the closing memo for a government research programme. Integrate across every study, state what the programme now knows that it did not before, and be explicit about what remains unanswered. Ground everything in the findings supplied.`;
    const user = `PROGRAMME: ${project.title}
SCOPE: ${JSON.stringify(project.brief_scope ?? {}).slice(0, 4_000)}

STUDY FINDINGS:
${withFindings
  .map(
    (s) =>
      `\n--- ${s.title} (${s.mode}/${s.method ?? "field"}) ---\n${JSON.stringify((s.config as Record<string, unknown>).field_finding).slice(0, 20_000)}`,
  )
  .join("\n")
  .slice(0, 120_000)}

Return JSON:
{
  "headline": "...",
  "what_we_now_know": ["..."],
  "recommendations": [{"recommendation":"...","owner":"...","urgency":"now|next|later"}],
  "open_questions": ["..."],
  "confidence": {"level":"high|moderate|low","why":"..."}
}`;

    const memo = await deriveJson<{ headline: string }>({
      system,
      user,
      validate: (v): v is { headline: string } =>
        !!v && typeof (v as { headline?: unknown }).headline === "string",
    });

    const { ingestFindingToCorpus } = await import("./field-corpus.server");
    const mem = await ingestFindingToCorpus({
      tag: {
        countryCode: project.country_code as string,
        projectId: project.id as string,
        projectTitle: project.title as string,
        studyId: project.id as string,
        studyTitle: project.title as string,
        method: "programme",
      },
      scope: "programme",
      title: `Research programme · ${project.title}`,
      finding: memo,
    });

    const { error: closeErr } = await supabase
      .from("persona_projects")
      .update({ status: "completed" } as never)
      .eq("id", data.projectId);
    if (closeErr) throw closeErr;




    return { memo, memoryId: mem?.id ?? null };
  });

/**
 * Reopen a closed programme so a finding can be corrected and re-filed.
 * The filed memo is left in place: re-closing writes over the same corpus key,
 * so revising never leaves two memos for one programme.
 */
export const reopenProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project } = await supabase
      .from("persona_projects")
      .select("id,status")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Research program not found");
    if (project.status !== "completed") return { status: project.status as string };

    const { error } = await supabase
      .from("persona_projects")
      .update({ status: "active" } as never)
      .eq("id", data.projectId);
    if (error) throw error;
    return { status: "active" };
  });

