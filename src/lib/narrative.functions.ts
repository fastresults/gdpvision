// Phase 4 — Narrative Chamber server functions (Second Brain + intake).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { corpusRead } from "@/lib/corpus/gateway.server";
import { searchMemory } from "@/lib/corpus/searchers/memory.server";
import { upsertMemoryObjects, type MemoryObjectInput } from "@/lib/corpus/writers.server";

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
  signalId: z.string().uuid().optional(),
});

async function recordLineage(
  signalId: string,
  artifactType: "strategy" | "comms",
  artifactId: string,
  scopeKey: string,
  sectorCode: string | null,
  userId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("narrative_lineage").insert({
    signal_id: signalId,
    artifact_type: artifactType,
    artifact_id: artifactId,
    scope_key: scopeKey,
    sector_code: sectorCode,
    created_by: userId,
  });
}

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
    if (data.signalId) {
      await recordLineage(data.signalId, "strategy", row.id, data.scopeKey, data.sectorCode, context.userId);
    }
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
  signalId: z.string().uuid().optional(),
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
    if (data.signalId) {
      await recordLineage(data.signalId, "comms", row.id, data.scopeKey, null, context.userId);
    }
    return { id: row.id };
  });


// ─── Comms approvals (tiered release doctrine) ──────────────────────────────

const APPROVAL_TIERS: Record<string, ("advisor" | "comms_director" | "line_minister" | "cabinet_secretary" | "admin")[]> = {
  draft: [],
  review: ["advisor", "comms_director", "line_minister", "cabinet_secretary", "admin"],
  approved: ["comms_director", "cabinet_secretary", "admin"],
  released: ["cabinet_secretary", "admin"],
};

// Detect numeric claims in body. Approval doctrine (§Phase 4): any fiscal
// figure must re-verify against the live Ledger at approval time. We surface
// candidate figures so the caller (or a follow-up job) can cross-check them.
function extractFigures(body: string): string[] {
  const out = new Set<string>();
  const re = /(?:USD?|EC\$|EUR|€|£|\$)\s?[\d,]+(?:\.\d+)?(?:\s?(?:million|billion|bn|m))?|\b\d+(?:\.\d+)?\s?%/gi;
  for (const m of body.matchAll(re)) out.add(m[0].trim());
  return [...out];
}

export const approveComms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      nextState: z.enum(["review", "approved", "released"]),
      note: z.string().max(500).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: fErr } = await context.supabase
      .from("comms_artifacts")
      .select("id,body,draft_state,approvals")
      .eq("id", data.id).single();
    if (fErr) throw new Error(fErr.message);

    const allowed = APPROVAL_TIERS[data.nextState] ?? [];
    let ok = false;
    for (const r of allowed) {
      const { data: has } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: r });
      if (has === true) { ok = true; break; }
    }
    if (!ok) throw new Error(`Role required for ${data.nextState}: ${allowed.join(" / ")}`);

    const figures = extractFigures(row.body ?? "");
    if (data.nextState === "released" && figures.length > 0) {
      if (!data.note || data.note.length < 4) {
        throw new Error(`Release blocked: ${figures.length} figure(s) require a Ledger sign-off note.`);
      }
    }

    const prevApprovals = Array.isArray(row.approvals) ? (row.approvals as unknown[]) : [];
    const entry = {
      at: new Date().toISOString(),
      by: context.userId,
      from: row.draft_state,
      to: data.nextState,
      note: data.note ?? null,
      figures,
    };

    const patch = {
      draft_state: data.nextState,
      approvals: [...prevApprovals, entry] as unknown as Json,
      updated_at: new Date().toISOString(),
      ...(data.nextState === "released" ? { released_at: new Date().toISOString() } : {}),
    };

    const { error: uErr } = await context.supabase.from("comms_artifacts").update(patch).eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, figures };
  });

// ─── Coverage & Gaps ────────────────────────────────────────────────────────

export const getCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScopeInput.parse(data))
  .handler(async ({ data, context }) => {
    const readMemory = async () =>
      (
        await context.supabase
          .from("memory_objects")
          .select("sector_code,kind")
          .eq("scope_key", data.scopeKey)
      ).data ?? [];

    // Corpus-first: if the second brain is thin for this scope, trigger the
    // external waterfall + write-back before computing coverage.
    const memGateway = await corpusRead<{ rows: Array<{ sector_code: string; kind: string }> }>({
      scope: { countryCode: data.scopeKey },
      domain: "memory",
      key: "coverage:all",
      read: async () => ({ rows: await readMemory() }),
      isEmpty: (t) => !t || t.rows.length < 5,
      search: async (ctx) => {
        const r = await searchMemory({ countryCode: ctx.countryCode });
        if (!r) return null;
        return {
          data: {
            rows: r.data.rows.map((row) => ({
              sector_code: row.sector_code ?? "cross",
              kind: row.kind ?? "evidence",
            })),
          },
          citations: r.citations,
          tier: r.tier,
          notes: r.notes,
        };
      },
      writeBack: async (_result) => {
        const searchRes = await searchMemory({ countryCode: data.scopeKey });
        if (searchRes?.data.rows.length) {
          await upsertMemoryObjects(searchRes.data.rows as MemoryObjectInput[]);
        }
      },
      budget: { maxMs: 25_000 },
      actor: context.userId,
    });

    const memRows =
      memGateway.source === "external" ? await readMemory() : memGateway.data.rows;

    const { data: sectorsData, error: sectorsErr } = await context.supabase
      .from("sectors")
      .select("code,label,sort_order")
      .order("sort_order");
    if (sectorsErr) throw new Error(sectorsErr.message);

    const kinds = ["audience", "position", "statement", "outlet", "precedent"] as const;
    const buckets = new Map<string, Record<string, number>>();
    for (const s of sectorsData ?? []) buckets.set(s.code, Object.fromEntries(kinds.map((k) => [k, 0])));
    for (const m of memRows) {
      const b = buckets.get(m.sector_code);
      if (b) b[m.kind] = (b[m.kind] ?? 0) + 1;
    }
    return (sectorsData ?? []).map((s) => ({
      sectorCode: s.code,
      sectorName: s.label,
      counts: buckets.get(s.code) ?? {},
    }));
  });


// ─── Comms Library (search / detail / manage) ───────────────────────────────

const LibrarySearch = z.object({
  scopeKey: z.string().min(3).max(16),
  q: z.string().max(200).optional(),
  states: z.array(z.enum(["draft", "review", "approved", "released"])).optional(),
  channels: z.array(z.string().max(60)).optional(),
  audiences: z.array(z.string().max(120)).optional(),
  tags: z.array(z.string().max(60)).optional(),
  isTemplate: z.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(["updated", "released", "channel"]).default("updated"),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const searchComms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LibrarySearch.parse(data))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("comms_artifacts")
      .select("id,title,kind,audience,channel,draft_state,released_at,updated_at,created_at,tags,is_template,signal_id,strategy_id,body")
      .eq("scope_key", data.scopeKey)
      .is("deleted_at", null);

    if (data.q && data.q.trim()) {
      const like = `%${data.q.trim().replace(/[%_]/g, (m) => `\\${m}`)}%`;
      q = q.or(`title.ilike.${like},body.ilike.${like},audience.ilike.${like}`);
    }
    if (data.states?.length) q = q.in("draft_state", data.states);
    if (data.channels?.length) q = q.in("channel", data.channels);
    if (data.audiences?.length) q = q.in("audience", data.audiences);
    if (data.tags?.length) q = q.contains("tags", data.tags);
    if (typeof data.isTemplate === "boolean") q = q.eq("is_template", data.isTemplate);
    if (data.from) q = q.gte("updated_at", data.from);
    if (data.to) q = q.lte("updated_at", data.to);

    const sortCol = data.sort === "released" ? "released_at" : data.sort === "channel" ? "channel" : "updated_at";
    q = q.order(sortCol, { ascending: false, nullsFirst: false }).range(data.offset, data.offset + data.limit - 1);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Snippet + attach signal topic
    const signalIds = Array.from(new Set((rows ?? []).map((r) => r.signal_id).filter(Boolean))) as string[];
    let signalMap = new Map<string, { topic: string | null; priority: number | null }>();
    if (signalIds.length) {
      const { data: sigs } = await context.supabase
        .from("intake_items")
        .select("id,topic,metadata")
        .in("id", signalIds);
      for (const s of sigs ?? []) {
        const meta = (s.metadata as Record<string, unknown> | null) ?? {};
        const priority = typeof meta.priority === "number" ? (meta.priority as number) : null;
        signalMap.set(s.id, { topic: s.topic ?? null, priority });
      }
    }

    return (rows ?? []).map((r) => {
      const body = r.body ?? "";
      const snippet = body.replace(/[#*_>`]/g, "").slice(0, 220);
      const sig = r.signal_id ? signalMap.get(r.signal_id) : null;
      return {
        id: r.id,
        title: r.title ?? deriveTitle(r.channel, sig?.topic),
        kind: r.kind,
        audience: r.audience,
        channel: r.channel,
        draft_state: r.draft_state,
        released_at: r.released_at,
        updated_at: r.updated_at,
        created_at: r.created_at,
        tags: r.tags ?? [],
        is_template: r.is_template ?? false,
        signal_id: r.signal_id,
        signal_topic: sig?.topic ?? null,
        signal_priority: sig?.priority ?? null,
        strategy_id: r.strategy_id,
        snippet,
      };
    });
  });

function deriveTitle(channel: string, topic: string | null | undefined): string {
  const c = channel ? channel.replace(/[_-]/g, " ") : "Draft";
  return topic ? `${c} — ${topic.slice(0, 80)}` : c;
}

export const getCommsDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("comms_artifacts")
      .select("id,scope_key,strategy_id,signal_id,kind,audience,channel,body,title,tags,is_template,draft_state,approvals,released_at,published_url,published_at,updated_at,created_at,created_by")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    let signal: { id: string; topic: string | null; priority: number | null } | null = null;
    if (row.signal_id) {
      const { data: s } = await context.supabase
        .from("intake_items")
        .select("id,topic,metadata")
        .eq("id", row.signal_id)
        .maybeSingle();
      if (s) {
        const meta = (s.metadata as Record<string, unknown> | null) ?? {};
        signal = { id: s.id, topic: s.topic ?? null, priority: typeof meta.priority === "number" ? (meta.priority as number) : null };
      }
    }

    type SourceRef = { url?: string; title?: string; publisher?: string };
    let strategySources: SourceRef[] = [];
    if (row.strategy_id) {
      const { data: st } = await context.supabase
        .from("strategy_statements")
        .select("sources")
        .eq("id", row.strategy_id)
        .maybeSingle();
      const src = (st?.sources as unknown) ?? [];
      if (Array.isArray(src)) strategySources = src as SourceRef[];
    }

    const { data: revisions } = await context.supabase
      .from("comms_artifact_revisions")
      .select("id,edited_at,editor_id,body")
      .eq("artifact_id", data.id)
      .order("edited_at", { ascending: false })
      .limit(50);

    return { artifact: row, signal, strategySources, revisions: revisions ?? [] };
  });

const MetaUpdate = z.object({
  id: z.string().uuid(),
  title: z.string().max(200).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  isTemplate: z.boolean().optional(),
});

export const updateCommsMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MetaUpdate.parse(data))
  .handler(async ({ data, context }) => {
    const patch: {
      updated_at: string;
      title?: string;
      tags?: string[];
      is_template?: boolean;
    } = { updated_at: new Date().toISOString() };
    if (typeof data.title === "string") patch.title = data.title;
    if (Array.isArray(data.tags)) patch.tags = data.tags;
    if (typeof data.isTemplate === "boolean") patch.is_template = data.isTemplate;
    const { error } = await context.supabase.from("comms_artifacts").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateComms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), asTemplate: z.boolean().default(false) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("comms_artifacts")
      .select("scope_key,strategy_id,signal_id,kind,audience,channel,body,title,tags")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: row, error: iErr } = await context.supabase
      .from("comms_artifacts")
      .insert({
        scope_key: src.scope_key,
        strategy_id: src.strategy_id,
        signal_id: data.asTemplate ? null : src.signal_id,
        kind: src.kind,
        audience: src.audience,
        channel: src.channel,
        body: src.body,
        title: (src.title ?? "Draft") + (data.asTemplate ? " (template)" : " (copy)"),
        tags: src.tags ?? [],
        is_template: data.asTemplate,
        draft_state: "draft",
        created_by: context.userId,
      })
      .select("id").single();
    if (iErr) throw new Error(iErr.message);
    return { id: row.id };
  });

export const deleteComms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: cur, error: fErr } = await context.supabase
      .from("comms_artifacts").select("draft_state").eq("id", data.id).single();
    if (fErr) throw new Error(fErr.message);
    if (cur.draft_state === "released") {
      throw new Error("Released artifacts cannot be deleted. Duplicate or supersede instead.");
    }
    const { error } = await context.supabase
      .from("comms_artifacts")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCommsFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScopeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("comms_artifacts")
      .select("channel,audience,tags,draft_state")
      .eq("scope_key", data.scopeKey)
      .is("deleted_at", null)
      .limit(1000);
    if (error) throw new Error(error.message);
    const channels = new Set<string>();
    const audiences = new Set<string>();
    const tags = new Set<string>();
    const states: Record<string, number> = { draft: 0, review: 0, approved: 0, released: 0 };
    for (const r of rows ?? []) {
      if (r.channel) channels.add(r.channel);
      if (r.audience) audiences.add(r.audience);
      for (const t of (r.tags ?? []) as string[]) tags.add(t);
      if (r.draft_state && states[r.draft_state] !== undefined) states[r.draft_state]++;
    }
    return {
      channels: [...channels].sort(),
      audiences: [...audiences].sort(),
      tags: [...tags].sort(),
      states,
    };
  });
