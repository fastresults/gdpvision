// Phase 4 — Narrative Chamber server functions (Second Brain + intake).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const ScopeInput = z.object({ scopeKey: z.string().min(3).max(16) });

// ─── Memory (Second Brain) ───────────────────────────────────────────────────

export interface MemoryObject {
  id: string;
  scope_key: string;
  sector_code: string;
  kind: string;
  title: string;
  weight: number;
  verified: boolean;
  updated_at: string;
}

export const listMemoryObjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      scopeKey: z.string().min(3).max(16),
      kind: z.string().optional(),
      sectorCode: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<MemoryObject[]> => {
    let q = context.supabase
      .from("memory_objects")
      .select("id,scope_key,sector_code,kind,title,weight,verified,updated_at")
      .eq("scope_key", data.scopeKey)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.sectorCode) q = q.eq("sector_code", data.sectorCode);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const MemoryUpsert = z.object({
  scopeKey: z.string().min(3).max(16),
  sectorCode: z.string().min(2).max(32),
  kind: z.enum(["audience", "position", "statement", "outlet", "precedent"]),
  title: z.string().min(1).max(300),
  payload: z.record(z.unknown()).default({}),
  weight: z.number().int().min(1).max(5).default(3),
  verified: z.boolean().default(false),
});

export const upsertMemoryObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MemoryUpsert.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("memory_objects")
      .insert({
        scope_key: data.scopeKey,
        sector_code: data.sectorCode,
        kind: data.kind,
        title: data.title,
        payload: data.payload as unknown as Json,
        weight: data.weight,
        verified: data.verified,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ─── Intake queue ────────────────────────────────────────────────────────────

export interface IntakeRow {
  id: string;
  scope_key: string;
  sector_code: string;
  topic: string;
  summary: string | null;
  url: string | null;
  proposed_weight: number;
  final_weight: number | null;
  state: string;
  created_at: string;
}

export const listIntake = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      scopeKey: z.string().min(3).max(16),
      state: z.enum(["pending", "accepted", "rejected", "deferred"]).default("pending"),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<IntakeRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("intake_items")
      .select("id,scope_key,sector_code,topic,summary,url,proposed_weight,final_weight,state,created_at")
      .eq("scope_key", data.scopeKey)
      .eq("state", data.state)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const IntakeCreate = z.object({
  scopeKey: z.string().min(3).max(16),
  sectorCode: z.string().min(2).max(32),
  topic: z.string().min(1).max(240),
  summary: z.string().max(2000).optional(),
  url: z.string().url().optional(),
  proposedWeight: z.number().int().min(1).max(5).default(3),
});

export const createIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IntakeCreate.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("intake_items")
      .insert({
        scope_key: data.scopeKey,
        sector_code: data.sectorCode,
        topic: data.topic,
        summary: data.summary ?? null,
        url: data.url ?? null,
        proposed_weight: data.proposedWeight,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const IntakeDecide = z.object({
  id: z.string().uuid(),
  decision: z.enum(["accepted", "rejected", "deferred"]),
  finalWeight: z.number().int().min(1).max(5).optional(),
  promoteAsKind: z.enum(["audience", "position", "statement", "outlet", "precedent"]).optional(),
});

export const decideIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IntakeDecide.parse(data))
  .handler(async ({ data, context }) => {
    const { data: item, error: fetchErr } = await context.supabase
      .from("intake_items")
      .select("id,scope_key,sector_code,topic,summary,proposed_weight")
      .eq("id", data.id)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error: updErr } = await context.supabase
      .from("intake_items")
      .update({
        state: data.decision,
        final_weight: data.finalWeight ?? item.proposed_weight,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    let promoted: string | null = null;
    if (data.decision === "accepted" && data.promoteAsKind) {
      const { data: mem, error: memErr } = await context.supabase
        .from("memory_objects")
        .insert({
          scope_key: item.scope_key,
          sector_code: item.sector_code,
          kind: data.promoteAsKind,
          title: item.topic,
          payload: { summary: item.summary ?? null } as unknown as Json,
          weight: data.finalWeight ?? item.proposed_weight,
          verified: true,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (memErr) throw new Error(memErr.message);
      promoted = mem.id;
    }
    return { ok: true, promoted };
  });

// ─── Strategy statements ────────────────────────────────────────────────────

const SEVEN_PART_KEYS = [
  "situation", "complication", "question", "answer", "grounds", "warrant", "call",
] as const;
type SevenPart = Record<(typeof SEVEN_PART_KEYS)[number], string>;
export const emptySevenPart = (): SevenPart => ({
  situation: "", complication: "", question: "", answer: "", grounds: "", warrant: "", call: "",
});

export const listStrategies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScopeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("strategy_statements")
      .select("id,title,sector_code,status,version,updated_at")
      .eq("scope_key", data.scopeKey)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getStrategy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("strategy_statements")
      .select("id,scope_key,sector_code,title,seven_part,sources,approvals,version,status,updated_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const StrategySave = z.object({
  id: z.string().uuid().optional(),
  scopeKey: z.string().min(3).max(16),
  sectorCode: z.string().min(2).max(32),
  title: z.string().min(1).max(240),
  sevenPart: z.object({
    situation: z.string().default(""),
    complication: z.string().default(""),
    question: z.string().default(""),
    answer: z.string().default(""),
    grounds: z.string().default(""),
    warrant: z.string().default(""),
    call: z.string().default(""),
  }),
  sources: z.array(z.object({ label: z.string(), ref: z.string() })).default([]),
  status: z.enum(["draft", "review", "adopted", "archived"]).default("draft"),
});

export const saveStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StrategySave.parse(data))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: prev } = await context.supabase
        .from("strategy_statements").select("version").eq("id", data.id).single();
      const { error } = await context.supabase
        .from("strategy_statements")
        .update({
          title: data.title,
          sector_code: data.sectorCode,
          seven_part: data.sevenPart as unknown as Json,
          sources: data.sources as unknown as Json,
          status: data.status,
          version: (prev?.version ?? 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("strategy_statements")
      .insert({
        scope_key: data.scopeKey,
        sector_code: data.sectorCode,
        title: data.title,
        seven_part: data.sevenPart as unknown as Json,
        sources: data.sources as unknown as Json,
        status: data.status,
        version: 1,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ─── Comms artifacts ────────────────────────────────────────────────────────

export const listComms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScopeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("comms_artifacts")
      .select("id,kind,audience,channel,draft_state,released_at,updated_at")
      .eq("scope_key", data.scopeKey)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getComms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("comms_artifacts")
      .select("id,scope_key,strategy_id,kind,audience,channel,body,draft_state,approvals,released_at,updated_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const CommsSave = z.object({
  id: z.string().uuid().optional(),
  scopeKey: z.string().min(3).max(16),
  strategyId: z.string().uuid().optional(),
  kind: z.enum(["press_release", "op_ed", "briefing", "speech", "social", "memo"]),
  audience: z.string().min(1).max(120),
  channel: z.string().min(1).max(60),
  body: z.string().min(1).max(20000),
  draftState: z.enum(["draft", "review", "approved", "released"]).default("draft"),
});

export const saveComms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CommsSave.parse(data))
  .handler(async ({ data, context }) => {
    const patch = {
      scope_key: data.scopeKey,
      strategy_id: data.strategyId ?? null,
      kind: data.kind,
      audience: data.audience,
      channel: data.channel,
      body: data.body,
      draft_state: data.draftState,
      released_at: data.draftState === "released" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await context.supabase.from("comms_artifacts").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("comms_artifacts")
      .insert({ ...patch, created_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

