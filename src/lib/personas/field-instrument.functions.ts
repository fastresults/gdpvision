// @domain personas
// @tables studies,field_instruments,persona_projects,programme_plans
// @ui src/components/personas/field/InstrumentBuilder.tsx

// Chamber 07 · Field instruments — questionnaires and discussion guides,
// AI-drafted to the specific objective of the study, never from a stock bank.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { deriveJson } from "./field-ai.server";

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
}

interface DraftPayload {
  title: string;
  intro: string;
  outro?: string;
  questions: FieldQuestion[];
}

function isDraft(v: unknown): v is DraftPayload {
  if (!v || typeof v !== "object") return false;
  const d = v as Partial<DraftPayload>;
  return (
    typeof d.title === "string" &&
    Array.isArray(d.questions) &&
    d.questions.length > 0 &&
    d.questions.every((q) => typeof q?.prompt === "string" && typeof q?.type === "string")
  );
}

const QuestionSchema = z.object({
  id: z.string().min(1).max(60),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().min(1).max(2_000),
  help: z.string().max(1_000).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().max(400)).max(40).optional(),
  scale_min: z.number().int().optional(),
  scale_max: z.number().int().optional(),
  scale_min_label: z.string().max(120).optional(),
  scale_max_label: z.string().max(120).optional(),
  rows: z.array(z.string().max(400)).max(40).optional(),
});

export const getInstrument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("field_instruments")
      .select("*")
      .eq("study_id", data.studyId)
      .order("version", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const draftInstrument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studyId: z.string().uuid(),
        kind: z.enum(["survey", "discussion_guide"]).optional(),
        steering: z.string().max(4_000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: study, error } = await supabase
      .from("studies")
      .select("id,title,objective,country_code,method,project_id,mode")
      .eq("id", data.studyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!study) throw new Error("Study not found");

    let briefBlock = "";
    let planBlock = "";
    if (study.project_id) {
      const { data: project } = await supabase
        .from("persona_projects")
        .select("title,brief_raw,brief_scope")
        .eq("id", study.project_id as string)
        .maybeSingle();
      if (project) {
        briefBlock = `PROGRAMME: ${project.title}\nBRIEF:\n${(project.brief_raw ?? "").slice(0, 8_000)}\nSCOPE: ${JSON.stringify(project.brief_scope ?? {}).slice(0, 3_000)}`;
      }
      const { data: plan } = await supabase
        .from("programme_plans")
        .select("summary,objectives,method_mix,audience")
        .eq("project_id", study.project_id as string)
        .eq("status", "active")
        .maybeSingle();
      if (plan) {
        planBlock = `ACTIVE PLAN: ${plan.summary}\nOBJECTIVES: ${JSON.stringify(plan.objectives).slice(0, 2_000)}\nMETHOD MIX: ${JSON.stringify(plan.method_mix).slice(0, 2_000)}\nAUDIENCE: ${JSON.stringify(plan.audience).slice(0, 1_500)}`;
      }
    }

    const kind = data.kind ?? (study.method === "survey" ? "survey" : "discussion_guide");
    const isGuide = kind === "discussion_guide";

    const system = `You are a senior research methodologist writing a real-world research instrument for a sovereign government client. Write to THIS study's objective. Never reach for a stock question bank, never pad with generic demographics unless the objective needs them.

${
  isGuide
    ? `You are writing a MODERATOR DISCUSSION GUIDE for a live session. Use "moderator_prompt" for opening, warm-up, probing and closing prompts, and "open_text" only where the moderator records a structured answer. Sequence the guide so rapport is built before sensitive ground.`
    : `You are writing a SELF-COMPLETION QUESTIONNAIRE. Keep language plain and neutral, avoid double-barrelled and leading items, put sensitive questions late, and keep the whole instrument completable in a reasonable sitting.`
}

Question ids must be short, lowercase, snake_case and unique. Scale questions must set scale_min, scale_max and both labels. Choice questions must have real, mutually exclusive options.`;

    const user = `${briefBlock}

${planBlock}

STUDY: ${study.title}
OBJECTIVE: ${study.objective ?? "(not stated — infer from the brief)"}
METHOD: ${study.method ?? kind}
COUNTRY: ${study.country_code}
${data.steering ? `\nSTEERING FROM THE RESEARCHER:\n${data.steering}` : ""}

Return JSON:
{
  "title": "instrument title",
  "intro": "what the respondent/participant is told up front, including why their input matters and how it will be used",
  "outro": "closing text",
  "questions": [{"id":"...","type":"${QUESTION_TYPES.join("|")}","prompt":"...","help":"...","required":true,"options":["..."],"scale_min":1,"scale_max":5,"scale_min_label":"...","scale_max_label":"...","rows":["..."]}]
}`;

    const draft = await deriveJson<DraftPayload>({ system, user, validate: isDraft });

    // Normalise ids so nothing collides.
    const used = new Set<string>();
    const questions = draft.questions.map((q, i) => {
      let id = (q.id ?? `q${i + 1}`).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
      if (!id || used.has(id)) id = `q${i + 1}`;
      used.add(id);
      return { ...q, id };
    });

    const { data: prev } = await supabase
      .from("field_instruments")
      .select("version")
      .eq("study_id", data.studyId)
      .order("version", { ascending: false })
      .limit(1);
    const version = ((prev?.[0]?.version as number | undefined) ?? 0) + 1;

    const { data: row, error: insErr } = await supabase
      .from("field_instruments")
      .insert({
        study_id: data.studyId,
        country_code: study.country_code as string,
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
    if (insErr) throw new Error(insErr.message);
    return row;
  });

export const saveInstrument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(240).nullish(),
        intro: z.string().max(8_000).nullish(),
        outro: z.string().max(8_000).nullish(),
        questions: z.array(QuestionSchema).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("field_instruments")
      .update({
        title: data.title ?? null,
        intro: data.intro ?? null,
        outro: data.outro ?? null,
        questions: data.questions as unknown as Json,
        generated_by: "human",
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
