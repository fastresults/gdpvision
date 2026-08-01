// @domain personas
// @tables studies,field_instruments,persona_projects,programme_plans
// @ui src/components/personas/field/InstrumentsStage.tsx

// Chamber 07 · Field instruments — questionnaires and discussion guides,
// AI-drafted to the specific objectives of the study, one per planned method,
// never from a stock bank.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  QUESTION_TYPES,
  draftAndStoreInstrument,
  latestInstruments,
  loadDerivationContext,
} from "./instrument-draft.server";
import type { FieldQuestion, InstrumentKind, InstrumentRow } from "./instrument-draft.server";

export { QUESTION_TYPES };
export type { FieldQuestion, InstrumentKind, InstrumentRow };

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
  objective_ref: z.number().int().optional(),
});

/** Everything the Instruments stage needs in one read: what is required, what exists, why. */
export const getInstruments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await loadDerivationContext(context.supabase, data.studyId);
    const instruments = await latestInstruments(context.supabase, data.studyId);
    return {
      required: ctx.required,
      objectives: ctx.objectives,
      provenance: ctx.provenance,
      instruments,
      missing: ctx.required.map((r) => r.kind).filter((k) => !instruments.some((i) => i.kind === k)),
    };
  });

/**
 * AI-first arrival: draft whatever the approved plan requires and this study
 * does not yet hold. Idempotent — returns immediately when nothing is missing.
 */
export const ensureInstruments = createServerFn({ method: "POST" })
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
    const ctx = await loadDerivationContext(context.supabase, data.studyId);
    const existing = await latestInstruments(context.supabase, data.studyId);
    const held = new Set(existing.map((i) => i.kind));
    const wanted = (data.kind ? [data.kind] : ctx.required.map((r) => r.kind)).filter(
      (k) => !held.has(k),
    );

    const derived: string[] = [];
    for (const kind of wanted) {
      await draftAndStoreInstrument(context.supabase, ctx, kind as InstrumentKind, data.steering);
      derived.push(kind);
    }
    return { derived, required: ctx.required.map((r) => r.kind) };
  });

/** Explicit re-draft of one instrument, replacing it with a new version. */
export const draftInstrument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studyId: z.string().uuid(),
        kind: z.enum(["survey", "discussion_guide"]),
        steering: z.string().max(4_000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadDerivationContext(context.supabase, data.studyId);
    return draftAndStoreInstrument(context.supabase, ctx, data.kind, data.steering);
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
