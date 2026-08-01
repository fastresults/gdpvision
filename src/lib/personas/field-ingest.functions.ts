// @domain personas
// @tables field_ingest_batches,field_responses,field_collections,field_sessions,field_instruments,studies
// @ui src/components/personas/field/fieldwork/IngestPanel.tsx

// Chamber 07 · Stage 04 — fieldwork ingestion endpoints.
//
// Research done outside this system still has to land inside it. These
// functions stage an uploaded artefact against the study's instrument, let a
// human correct the mapping, and commit the result to the fieldwork ledger and
// the second brain.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { FieldQuestion } from "./instrument-draft.server";

const StageInput = z.object({
  studyId: z.string().uuid(),
  waveId: z.string().max(120).nullish(),
  collectionId: z.string().uuid().nullish(),
  sessionId: z.string().uuid().nullish(),
  instrumentId: z.string().uuid().nullish(),
  storagePath: z.string().min(1).max(400),
  filename: z.string().min(1).max(240),
  mimeType: z.string().max(160).default("application/octet-stream"),
  expect: z.enum(["tabular", "narrative"]).nullish(),
});

/** Read one uploaded file, map it to the instrument, park it for review. */
export const stageIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StageInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { stageArtifact } = await import("./field-ingest.server");

    const { data: study } = await supabase
      .from("studies")
      .select("id,country_code")
      .eq("id", data.studyId)
      .maybeSingle();
    if (!study) throw new Error("Study not found");

    // The instrument of record: the one named, or the newest of the right kind.
    const wantGuide = !!data.sessionId || data.expect === "narrative";
    let query = supabase
      .from("field_instruments")
      .select("id,version,questions,kind")
      .eq("study_id", data.studyId);
    if (data.instrumentId) query = query.eq("id", data.instrumentId);
    else query = query.eq("kind", wantGuide ? "discussion_guide" : "survey");
    const { data: instruments } = await query.order("version", { ascending: false }).limit(1);
    const inst = instruments?.[0];

    const batch = await stageArtifact({
      supabase,
      studyId: data.studyId,
      countryCode: study.country_code as string,
      waveId: data.waveId ?? null,
      collectionId: data.collectionId ?? null,
      sessionId: data.sessionId ?? null,
      instrument: inst
        ? {
            id: inst.id as string,
            version: (inst.version as number) ?? 1,
            questions: ((inst.questions ?? []) as unknown as FieldQuestion[]) ?? [],
          }
        : null,
      storagePath: data.storagePath,
      filename: data.filename,
      mimeType: data.mimeType,
      userId: userId ?? null,
      ...(data.expect ? { expect: data.expect } : {}),
    });
    return batch;
  });

/** Every batch filed against this study, newest first. */
export const listIngestBatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studyId: z.string().uuid(), waveId: z.string().max(120).nullish() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { toBatch } = await import("./field-ingest.server");
    let q = context.supabase
      .from("field_ingest_batches")
      .select("*")
      .eq("study_id", data.studyId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (data.waveId) q = q.eq("wave_id", data.waveId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toBatch);
  });

/** Human correction of the AI's reading before anything is committed. */
export const reviseIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        mapping: z
          .array(
            z.object({
              column: z.string().max(400),
              question_id: z.string().max(60).nullable(),
              confidence: z.number().min(0).max(1),
              note: z.string().max(400).optional(),
            }),
          )
          .max(400)
          .optional(),
        staged: z.array(z.record(z.string(), z.unknown())).max(5_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.mapping) {
      patch["mapping"] = data.mapping as unknown as Json;
      patch["mapped_count"] = data.mapping.filter((m) => m.question_id).length;
      patch["unmapped_count"] = data.mapping.filter((m) => !m.question_id).length;
    }
    if (data.staged) patch["staged"] = data.staged as unknown as Json;
    const { error } = await context.supabase
      .from("field_ingest_batches")
      .update(patch as never)
      .eq("id", data.batchId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** File a reviewed batch into the ledger and the second brain. */
export const commitIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ batchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { commitBatch } = await import("./field-ingest.server");
    return commitBatch(context.supabase, data.batchId);
  });

export const discardIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ batchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("field_ingest_batches")
      .delete()
      .eq("id", data.batchId)
      .eq("status", "staged");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
