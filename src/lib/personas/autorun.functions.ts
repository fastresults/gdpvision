// Chamber 07 · Research Studio · Durable auto-run orchestrator.
// One tick = one phase, guarded by an advisory heartbeat lock.
// Idempotent, resumable, and safe against tab close / double click / two tabs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json, Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SB = SupabaseClient<Database>;

import { commitStudy, draftCast, enrichBrief, enrichOutcome } from "./wizard.functions";
import { draftStudyQuestions, runStudy } from "./study.functions";

export type AutoRunPhase = "brief" | "outcome" | "cast" | "commit" | "synthesis";
export type PhaseState = "pending" | "running" | "done" | "skipped" | "failed";

export type PhaseLogEntry = {
  phase: AutoRunPhase;
  state: PhaseState;
  ts: string;
  duration_ms?: number;
  model?: string;
  run_id?: string;
  summary?: string;
  error?: string;
};

export type AutorunStatus = {
  status: "queued" | "running" | "done" | "failed" | "canceled";
  next_phase: AutoRunPhase | null;
  last_phase?: AutoRunPhase | null;
  message?: string | null;
  updated_at: string;
};

const PHASE_ORDER: AutoRunPhase[] = ["brief", "outcome", "cast", "commit", "synthesis"];
const LOCK_TTL_MS = 60_000;
const DEFAULT_DELIVERABLES = [
  "scqa_memo", "stakeholder_map", "segment_matrix",
  "focus_group_guide", "survey", "exec_readout",
];

// Which phase runs next, derived from persisted draft state.
function deriveNextPhase(draft: {
  brief_scope: Json | null;
  outcome_blueprint: Json | null;
  cast_draft: Json | null;
  study_id: string | null;
  // synthesis is derived from the study row, not the draft
}): AutoRunPhase | null {
  if (!draft.brief_scope) return "brief";
  const bp = draft.outcome_blueprint as { deliverables?: unknown[]; ai_status?: string } | null;
  const needsOutcome = !bp?.deliverables?.length || bp?.ai_status === "scaffold_only";
  if (needsOutcome) return "outcome";
  const cast = draft.cast_draft as { personas?: unknown[] } | null;
  if (!cast?.personas?.length) return "cast";
  if (!draft.study_id) return "commit";
  return "synthesis"; // orchestrator decides whether to skip based on study.status
}

type DraftLockRow = {
  id: string;
  country_code: string;
  brief_raw: string | null;
  brief_scope: Json | null;
  outcome_blueprint: Json | null;
  cast_draft: Json | null;
  study_id: string | null;
  locked_at: string | null;
  autorun_status: AutorunStatus | null;
  phase_log: PhaseLogEntry[] | null;
};

async function loadDraft(supabase: SB, id: string) {
  return supabase
    .from("persona_study_drafts")
    .select("id,country_code,brief_raw,brief_scope,outcome_blueprint,cast_draft,study_id,locked_at,locked_by,autorun_status,phase_log")
    .eq("id", id)
    .maybeSingle();
}

// ── startAutorun ─────────────────────────────────────────────────────────
const StartInput = z.object({ draftId: z.string().uuid() });

export const startAutorun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const status: AutorunStatus = {
      status: "queued",
      next_phase: null,
      updated_at: now,
      message: "Queued for auto-run",
    };
    // Only reset status/lock; keep phase_log for full history.
    const { error } = await context.supabase
      .from("persona_study_drafts")
      .update({
        autorun_status: status as unknown as Json,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", data.draftId);
    if (error) throw new Error(error.message);
    return { ok: true, status };
  });

// ── getAutorunStatus ─────────────────────────────────────────────────────
const GetInput = z.object({ draftId: z.string().uuid() });

export const getAutorunStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await loadDraft(context.supabase, data.draftId);
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Draft not found");
    const draft = row as DraftLockRow;
    // Ignore any legacy autorun_status shape (pre-refactor rows without a `status` key).
    const rawStatus = draft.autorun_status as (AutorunStatus & Record<string, unknown>) | null;
    const status: AutorunStatus =
      rawStatus && typeof rawStatus.status === "string"
        ? rawStatus
        : { status: "queued", next_phase: null, updated_at: new Date().toISOString() };
    const nextPhase = deriveNextPhase({
      brief_scope: draft.brief_scope,
      outcome_blueprint: draft.outcome_blueprint,
      cast_draft: draft.cast_draft,
      study_id: draft.study_id,
    });
    const locked = draft.locked_at && (Date.now() - Date.parse(draft.locked_at)) < LOCK_TTL_MS;
    return {
      status: status.status,
      nextPhase,
      lastPhase: status.last_phase ?? null,
      message: status.message ?? null,
      phaseLog: (draft.phase_log ?? []) as PhaseLogEntry[],
      locked: Boolean(locked),
      studyId: draft.study_id,
      done: nextPhase === null || status.status === "done",
      canceled: status.status === "canceled",
    };
  });

// ── cancelAutorun ────────────────────────────────────────────────────────
export const cancelAutorun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetInput.parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { data: row } = await loadDraft(context.supabase, data.draftId);
    const draft = row as DraftLockRow | null;
    const prev = (draft?.autorun_status as AutorunStatus | null) ?? { status: "queued", next_phase: null, updated_at: now };
    const next: AutorunStatus = { ...prev, status: "canceled", updated_at: now, message: "Canceled by user" };
    await context.supabase
      .from("persona_study_drafts")
      .update({ autorun_status: next as unknown as Json })
      .eq("id", data.draftId);
    return { ok: true };
  });

// ── runAutorunTick ───────────────────────────────────────────────────────
// Runs at most ONE phase per invocation. Returns nextPhase for the caller
// to keep ticking. Idempotent — re-derives what's already done from state.

const TickInput = z.object({ draftId: z.string().uuid() });

export const runAutorunTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TickInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const draftId = data.draftId;

    // 1. Load & check cancellation
    const { data: row } = await loadDraft(supabase, draftId);
    if (!row) throw new Error("Draft not found");
    const draft = row as DraftLockRow;
    const currentStatus = (draft.autorun_status as AutorunStatus | null) ?? null;
    if (currentStatus?.status === "canceled") {
      return { done: true, canceled: true, nextPhase: null };
    }

    // 2. Compare-and-set lock (60s TTL)
    const lockToken = `${context.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const staleBefore = new Date(Date.now() - LOCK_TTL_MS).toISOString();
    const { data: lockResult, error: lockErr } = await supabase
      .from("persona_study_drafts")
      .update({ locked_at: new Date().toISOString(), locked_by: lockToken })
      .eq("id", draftId)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select("id");
    if (lockErr) throw new Error(`Lock error: ${lockErr.message}`);
    if (!lockResult?.length) {
      return { locked: true, nextPhase: null, done: false, message: "Another tick is running" };
    }

    // 3. Derive next phase
    const nextPhase = deriveNextPhase({
      brief_scope: draft.brief_scope,
      outcome_blueprint: draft.outcome_blueprint,
      cast_draft: draft.cast_draft,
      study_id: draft.study_id,
    });
    if (!nextPhase) {
      await releaseLock(supabase, draftId, {
        status: "done", next_phase: null, updated_at: new Date().toISOString(), message: "All phases complete",
      });
      return { done: true, nextPhase: null };
    }

    // 4. Announce running
    const runningStatus: AutorunStatus = {
      status: "running",
      next_phase: nextPhase,
      last_phase: nextPhase,
      updated_at: new Date().toISOString(),
      message: `Running ${nextPhase}…`,
    };
    await supabase
      .from("persona_study_drafts")
      .update({ autorun_status: runningStatus as unknown as Json })
      .eq("id", draftId);

    // 5. Execute one phase
    const startedAt = Date.now();
    const log: PhaseLogEntry[] = [...(draft.phase_log ?? [])];
    try {
      const summary = await executePhase(nextPhase, draft, supabase);
      const durationMs = Date.now() - startedAt;
      const entry: PhaseLogEntry = {
        phase: nextPhase,
        state: summary.skipped ? "skipped" : "done",
        ts: new Date().toISOString(),
        duration_ms: durationMs,
        summary: summary.text,
      };
      log.push(entry);
      // Recompute next phase from the post-phase state.
      const { data: after } = await loadDraft(supabase, draftId);
      const afterDraft = after as DraftLockRow | null;
      const newNext = afterDraft ? deriveNextPhase({
        brief_scope: afterDraft.brief_scope,
        outcome_blueprint: afterDraft.outcome_blueprint,
        cast_draft: afterDraft.cast_draft,
        study_id: afterDraft.study_id,
      }) : null;
      const finalStatus: AutorunStatus = {
        status: newNext ? "queued" : "done",
        next_phase: newNext,
        last_phase: nextPhase,
        updated_at: new Date().toISOString(),
        message: newNext ? `Ready: ${newNext}` : "All phases complete",
      };
      await releaseLock(supabase, draftId, finalStatus, log);
      return { done: newNext === null, nextPhase: newNext, phase: nextPhase, state: entry.state };
    } catch (e) {
      const err = e as Error & { model?: string; runId?: string };
      const entry: PhaseLogEntry = {
        phase: nextPhase,
        state: "failed",
        ts: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        model: err.model,
        run_id: err.runId,
        error: (err?.message ?? String(e)).slice(0, 600),
      };
      log.push(entry);
      const failedStatus: AutorunStatus = {
        status: "failed",
        next_phase: nextPhase, // stays on the failing phase so retry resumes it
        last_phase: nextPhase,
        updated_at: new Date().toISOString(),
        message: entry.error ?? "Phase failed",
      };
      await releaseLock(supabase, draftId, failedStatus, log);
      return { done: false, error: entry.error, phase: nextPhase, state: "failed" as const, nextPhase };
    }
  });

async function releaseLock(
  supabase: SB,
  draftId: string,
  status: AutorunStatus,
  phaseLog?: PhaseLogEntry[],
) {
  const patch = {
    locked_at: null as string | null,
    locked_by: null as string | null,
    autorun_status: status as unknown as Json,
    ...(phaseLog ? { phase_log: phaseLog as unknown as Json } : {}),
  };
  await supabase.from("persona_study_drafts").update(patch).eq("id", draftId);
}

async function executePhase(
  phase: AutoRunPhase,
  draft: DraftLockRow,
  _supabase: SB,
): Promise<{ text: string; skipped?: boolean }> {
  const countryCode = draft.country_code;
  switch (phase) {
    case "brief": {
      const raw = (draft.brief_raw ?? "").trim();
      if (raw.length < 3) {
        throw new Error("Draft has no brief text. Add a brief before starting auto-run.");
      }
      const res = await enrichBrief({ data: { draftId: draft.id, countryCode, raw: raw.slice(0, 20_000) } });
      if ((res as { alreadyDone?: boolean }).alreadyDone) {
        return { text: "Scope already enriched.", skipped: true };
      }
      const scope = res.scope;
      return {
        text: `${scope.title.slice(0, 80)} · ${scope.objectives?.length ?? 0} objectives`,
      };
    }
    case "outcome": {
      const res = await enrichOutcome({
        data: {
          draftId: draft.id,
          countryCode,
          selectedCodes: DEFAULT_DELIVERABLES,
          tone: "cabinet",
        },
      });
      if ((res as { alreadyDone?: boolean }).alreadyDone) {
        return { text: `${res.blueprint.deliverables.length} deliverables (already refined).`, skipped: true };
      }
      const status = res.blueprint.ai_status ?? "enriched";
      return { text: `${res.blueprint.deliverables.length} deliverables · ${status}` };
    }
    case "cast": {
      const res = await draftCast({
        data: { draftId: draft.id, countryCode, personaCount: 8, segmentCount: 4, allowDeepResearch: true },
      });
      if ((res as { alreadyDone?: boolean }).alreadyDone) {
        return { text: `${res.cast.personas.length} personas already cast.`, skipped: true };
      }
      return {
        text: `${res.cast.personas.length} personas · ${res.cast.segments.length} segments · ${res.cast.instruments.length} instruments · ${res.cast.deep_research.length} deep-research passes`,
      };
    }
    case "commit": {
      const res = await commitStudy({ data: { draftId: draft.id, countryCode, visibility: "private" } });
      if ((res as { alreadyDone?: boolean }).alreadyDone) {
        return { text: "Study already committed.", skipped: true };
      }
      return { text: `Study committed · ${res.personaCount} personas persisted` };
    }
    case "synthesis": {
      if (!draft.study_id) throw new Error("Cannot synthesize without a committed study.");
      await draftStudyQuestions({ data: { studyId: draft.study_id, count: 8 } });
      await runStudy({ data: { studyId: draft.study_id } });
      return { text: "Questions drafted · responses generated · brief synthesized" };
    }
  }
}
