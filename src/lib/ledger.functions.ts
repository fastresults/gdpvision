// Ledger server functions (PRD §7.1 Chamber 1). All reads run under the
// authenticated user's RLS via requireSupabaseAuth; writes are additionally
// role-gated inside the handler with has_role().

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const CountryInput = z.object({ countryCode: z.string().min(3).max(4) });

export interface InstanceOverview {
  country: {
    code: string;
    name: string;
    currency: string;
    fiscalYearStartMonth: number;
    isCbiState: boolean;
    countryPack: Record<string, string | number | boolean | null | Record<string, string>>;
  };
  composition: Array<{
    sector_code: string;
    share_pct: number;
    confidence_grade: string;
  }>;
  exposureIndex: {
    period: string;
    value: number;
    confidence_grade: string;
  } | null;
}

export const getInstanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<InstanceOverview> => {
    const { supabase } = context;

    const [{ data: country, error: countryErr }, { data: comp, error: compErr }, { data: exp }] =
      await Promise.all([
        supabase
          .from("countries")
          .select("code,name,currency,fiscal_year_start_month,is_cbi_state,country_pack")
          .eq("code", data.countryCode)
          .maybeSingle(),
        supabase
          .from("country_sectors")
          .select("sector_code,share_pct,confidence_grade")
          .eq("country_code", data.countryCode),
        supabase
          .from("exposure_index")
          .select("period,value,confidence_grade")
          .eq("country_code", data.countryCode)
          .order("period", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (countryErr) throw new Error(countryErr.message);
    if (compErr) throw new Error(compErr.message);
    if (!country) throw new Error(`Country ${data.countryCode} not found`);

    return {
      country: {
        code: country.code,
        name: country.name,
        currency: country.currency,
        fiscalYearStartMonth: country.fiscal_year_start_month,
        isCbiState: country.is_cbi_state,
        countryPack: (country.country_pack ?? {}) as InstanceOverview["country"]["countryPack"],
      },
      composition: (comp ?? []).map((row) => ({
        sector_code: row.sector_code,
        share_pct: Number(row.share_pct),
        confidence_grade: row.confidence_grade,
      })),
      exposureIndex: exp
        ? {
            period: exp.period,
            value: Number(exp.value),
            confidence_grade: exp.confidence_grade,
          }
        : null,
    };
  });

export const listInstanceBindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("instance_bindings")
      .select("country_code,is_default,countries(name,currency,is_cbi_state)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── Sector Detail ────────────────────────────────────────────────────────────

const SectorInput = z.object({
  countryCode: z.string().min(3).max(4),
  sectorCode: z.string().min(2).max(64),
});

export interface SectorDetail {
  country: { code: string; name: string; currency: string };
  sector: { code: string; share_pct: number; confidence_grade: string };
  series: Array<{
    id: string;
    metric: string;
    unit: string;
    frequency: string;
    confidence_grade: string;
    source_name: string | null;
    points: Array<{ period: string; value: number }>;
  }>;
}

export const getSectorDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SectorInput.parse(data))
  .handler(async ({ data, context }): Promise<SectorDetail> => {
    const { supabase } = context;

    const [{ data: country }, { data: comp }, { data: seriesRows }] = await Promise.all([
      supabase
        .from("countries")
        .select("code,name,currency")
        .eq("code", data.countryCode)
        .maybeSingle(),
      supabase
        .from("country_sectors")
        .select("sector_code,share_pct,confidence_grade")
        .eq("country_code", data.countryCode)
        .eq("sector_code", data.sectorCode)
        .maybeSingle(),
      supabase
        .from("series")
        .select("id,metric,unit,frequency,confidence_grade,sources(name)")
        .eq("country_code", data.countryCode)
        .eq("sector_code", data.sectorCode)
        .order("metric", { ascending: true }),
    ]);

    if (!country) throw new Error(`Country ${data.countryCode} not found`);

    const seriesIds = (seriesRows ?? []).map((s) => s.id);
    const points = seriesIds.length
      ? (
          await supabase
            .from("series_points")
            .select("series_id,period,value")
            .in("series_id", seriesIds)
            .order("period", { ascending: true })
        ).data ?? []
      : [];

    return {
      country: { code: country.code, name: country.name, currency: country.currency },
      sector: {
        code: data.sectorCode,
        share_pct: comp ? Number(comp.share_pct) : 0,
        confidence_grade: comp?.confidence_grade ?? "D",
      },
      series: (seriesRows ?? []).map((s) => ({
        id: s.id,
        metric: s.metric,
        unit: s.unit,
        frequency: s.frequency,
        confidence_grade: s.confidence_grade,
        source_name:
          (s.sources as unknown as { name: string } | null)?.name ?? null,
        points: points
          .filter((p) => p.series_id === s.id)
          .map((p) => ({ period: p.period, value: Number(p.value) })),
      })),
    };
  });

// ─── Exposure Index (full history + decomposition) ───────────────────────────

export interface ExposureHistory {
  country: { code: string; name: string };
  history: Array<{
    period: string;
    value: number;
    confidence_grade: string;
    methodology_ref: string | null;
    decomposition: Record<string, number>;
  }>;
}

export const getExposureHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<ExposureHistory> => {
    const { supabase } = context;
    const [{ data: country }, { data: rows, error }] = await Promise.all([
      supabase
        .from("countries")
        .select("code,name")
        .eq("code", data.countryCode)
        .maybeSingle(),
      supabase
        .from("exposure_index")
        .select("period,value,confidence_grade,methodology_ref,decomposition")
        .eq("country_code", data.countryCode)
        .order("period", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    if (!country) throw new Error(`Country ${data.countryCode} not found`);
    return {
      country: { code: country.code, name: country.name },
      history: (rows ?? []).map((r) => ({
        period: r.period,
        value: Number(r.value),
        confidence_grade: r.confidence_grade,
        methodology_ref: r.methodology_ref,
        decomposition: (r.decomposition ?? {}) as Record<string, number>,
      })),
    };
  });

// ─── Stewardship queue ───────────────────────────────────────────────────────

export interface StewardshipQueue {
  isSteward: boolean;
  revisions: Array<{
    id: string;
    created_at: string;
    reason: string | null;
    period: string | null;
    previous_value: number | null;
    new_value: number | null;
    series: { metric: string; country_code: string; sector_code: string } | null;
  }>;
  seriesCounts: {
    total: number;
    graded: Record<string, number>;
  };
}

export const getStewardshipQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<StewardshipQueue> => {
    const { supabase, userId } = context;

    const [{ data: stewardCheck }, { data: adminCheck }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "data_steward" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    const isSteward = Boolean(stewardCheck) || Boolean(adminCheck);

    const { data: seriesRows } = await supabase
      .from("series")
      .select("id,confidence_grade")
      .eq("country_code", data.countryCode);

    const graded: Record<string, number> = {};
    for (const r of seriesRows ?? []) {
      graded[r.confidence_grade] = (graded[r.confidence_grade] ?? 0) + 1;
    }

    const seriesIds = (seriesRows ?? []).map((r) => r.id);
    const { data: revisions } = seriesIds.length
      ? await supabase
          .from("data_revisions")
          .select(
            "id,created_at,reason,period,previous_value,new_value,series:series_id(metric,country_code,sector_code)",
          )
          .in("series_id", seriesIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] };

    return {
      isSteward,
      seriesCounts: { total: seriesRows?.length ?? 0, graded },
      revisions: (revisions ?? []).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        reason: r.reason,
        period: r.period,
        previous_value: r.previous_value !== null ? Number(r.previous_value) : null,
        new_value: r.new_value !== null ? Number(r.new_value) : null,
        series: (r.series as unknown as {
          metric: string;
          country_code: string;
          sector_code: string;
        } | null) ?? null,
      })),
    };
  });

// ─── "Why this number?" — Second-Brain-grounded AI explanation ───────────────
//
// AI-first contract:
//   - Retrieval ONLY from country_source_chunks + memory_objects + onboarding_citations.
//   - No retrieved evidence → return { grounded: false, answer: null, citations: [] }.
//   - Never invent figures. The UI refuses to render answers without citations.

const ExplainFigureInput = z.object({
  countryCode: z.string().min(3).max(4),
  figureKind: z.enum(["sector_share", "cbi_exposure", "series_point", "composition_total", "capital_flow"]),
  figureRef: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
  label: z.string().min(1).max(240),
  value: z.union([z.number(), z.string(), z.null()]).optional(),
  unit: z.string().max(64).optional(),
  confidenceGrade: z.string().max(1).optional(),
});

export interface FigureCitation {
  n: number;                       // 1-indexed marker for [N]
  kind: "chunk" | "memory" | "citation" | "web";
  title: string;
  url: string | null;
  org: string | null;
  source_id: string | null;
  excerpt: string;
}

export interface FigureRevisionRow {
  id: string;
  created_at: string;
  reason: string | null;
  period: string | null;
  previous_value: number | null;
  new_value: number | null;
}

export interface FigureExplanation {
  grounded: boolean;
  answer: string | null;             // model paragraph with [N] markers, or null if ungrounded
  refusal_reason?: string;
  figure: {
    kind: string;
    label: string;
    value: number | string | null;
    unit: string | null;
    confidence_grade: string | null;
  };
  citations: FigureCitation[];
  revisions: FigureRevisionRow[];
  provenance: {
    ingest_runs: number;
    last_ingested_at: string | null;
    reviewers: string[];
  };
}

function tokenizeQuery(s: string): string[] {
  return Array.from(new Set(s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])).slice(0, 8);
}

export const explainFigure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ExplainFigureInput.parse(data))
  .handler(async ({ data, context }): Promise<FigureExplanation> => {
    const { supabase } = context;

    // Build a retrieval query from the figure label + any sector/metric hints.
    const hints: string[] = [data.label];
    if (typeof data.figureRef.sector_code === "string") hints.push(data.figureRef.sector_code);
    if (typeof data.figureRef.metric === "string") hints.push(data.figureRef.metric);
    if (typeof data.figureRef.period === "string") hints.push(data.figureRef.period);
    const query = hints.filter(Boolean).join(" ");
    const tokens = tokenizeQuery(query);

    // Drop suppressed sources for this country scope.
    const { data: suppressions } = await supabase
      .from("source_suppressions")
      .select("source_id")
      .eq("scope_key", data.countryCode)
      .eq("active", true);
    const suppressed = new Set((suppressions ?? []).map((s) => s.source_id));

    // 1. Chunk retrieval — keyword scan (embeddings backfill lands later).
    const orFilter = tokens.length
      ? tokens.map((t) => `content.ilike.%${t.replace(/[%_]/g, "")}%`).join(",")
      : null;
    let chunkQuery = supabase
      .from("country_source_chunks")
      .select("id,content,chunk_index,document_id,country_source_documents!inner(country_source_id,title,country_sources!inner(id,url,title,org))")
      .eq("country_code", data.countryCode)
      .limit(30);
    if (orFilter) chunkQuery = chunkQuery.or(orFilter);
    const { data: chunkRows } = await chunkQuery;

    type ChunkRow = {
      id: string;
      content: string;
      chunk_index: number;
      country_source_documents: {
        country_source_id: string;
        title: string | null;
        country_sources: { id: string; url: string | null; title: string | null; org: string | null };
      } | null;
    };
    const chunks: FigureCitation[] = (chunkRows as unknown as ChunkRow[] | null ?? [])
      .filter((c) => {
        const sid = c.country_source_documents?.country_sources.id ?? null;
        return !sid || !suppressed.has(sid);
      })
      .slice(0, 6)
      .map((c, i) => ({
        n: i + 1,
        kind: "chunk" as const,
        title:
          c.country_source_documents?.country_sources.title ??
          c.country_source_documents?.title ??
          "Source document",
        url: c.country_source_documents?.country_sources.url ?? null,
        org: c.country_source_documents?.country_sources.org ?? null,
        source_id: c.country_source_documents?.country_sources.id ?? null,
        excerpt: (c.content ?? "").slice(0, 400),
      }));

    // 2. Memory objects (Second Brain narrative memory).
    let memQuery = supabase
      .from("memory_objects")
      .select("id,title,kind,sector_code,weight,payload,source_id")
      .in("scope_key", [data.countryCode, "REGIONAL"])
      .order("weight", { ascending: false })
      .limit(20);
    if (typeof data.figureRef.sector_code === "string") {
      memQuery = memQuery.eq("sector_code", data.figureRef.sector_code);
    }
    const { data: memRows } = await memQuery;
    const memories: FigureCitation[] = (memRows ?? [])
      .filter((m) => !m.source_id || !suppressed.has(m.source_id))
      .slice(0, 3)
      .map((m, i) => ({
        n: chunks.length + i + 1,
        kind: "memory" as const,
        title: m.title,
        url: null,
        org: m.kind,
        source_id: m.source_id,
        excerpt: JSON.stringify(m.payload ?? {}).slice(0, 300),
      }));

    // 3. Revisions (audit trail for this figure, if it maps to a series).
    let revisions: FigureRevisionRow[] = [];
    if (data.figureKind === "series_point" && typeof data.figureRef.series_id === "string") {
      const { data: revs } = await supabase
        .from("data_revisions")
        .select("id,created_at,reason,period,previous_value,new_value")
        .eq("series_id", data.figureRef.series_id)
        .order("created_at", { ascending: false })
        .limit(10);
      revisions = (revs ?? []).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        reason: r.reason,
        period: r.period,
        previous_value: r.previous_value !== null ? Number(r.previous_value) : null,
        new_value: r.new_value !== null ? Number(r.new_value) : null,
      }));
    }

    const citations = [...chunks, ...memories];

    const figure = {
      kind: data.figureKind,
      label: data.label,
      value: data.value !== undefined ? (typeof data.value === "string" ? data.value : Number(data.value)) : null,
      unit: data.unit ?? null,
      confidence_grade: data.confidenceGrade ?? null,
    };

    if (citations.length === 0) {
      return {
        grounded: false,
        answer: null,
        refusal_reason: "The Second Brain has no matching evidence for this figure yet.",
        figure,
        citations: [],
        revisions,
        provenance: { ingest_runs: 0, last_ingested_at: null, reviewers: [] },
      };
    }

    // 4. Grounded AI explanation.
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      // Still return citations even when the model is unavailable; the panel degrades gracefully.
      return {
        grounded: false,
        answer: null,
        refusal_reason: "AI gateway unavailable — showing raw citations only.",
        figure,
        citations,
        revisions,
        provenance: { ingest_runs: 0, last_ingested_at: null, reviewers: [] },
      };
    }

    const contextBlock = citations
      .map((c) => `[${c.n}] (${c.kind}·${c.org ?? "n/a"}) ${c.title}\n${c.excerpt}`)
      .join("\n\n");

    const figureLine = `Figure: ${figure.label}${figure.value !== null ? ` = ${figure.value}${figure.unit ? " " + figure.unit : ""}` : ""}${figure.confidence_grade ? ` (grade ${figure.confidence_grade})` : ""}`;

    const system =
      "You are the National Ledger's explainer. In ONE paragraph (max 90 words), explain what the figure means and what drives it, using ONLY the evidence in CONTEXT. Cite every factual claim with [N] markers matching the CONTEXT items. If the evidence does not support the figure, say 'Evidence in the Second Brain does not directly support this figure' and stop. Never invent numbers, names, or dates.";

    let answer: string | null = null;
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const result = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt: `${figureLine}\n\nCONTEXT:\n${contextBlock}\n\nWrite the explanation now.`,
      });
      answer = (result.text ?? "").trim() || null;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 429) throw new Error("Ledger AI rate limit — try again shortly.");
      if (status === 402) throw new Error("Lovable AI credits exhausted — top up in workspace billing.");
      throw err;
    }

    // Only mark grounded if the model actually cited something from the context.
    const grounded = !!answer && /\[\d+\]/.test(answer);

    return {
      grounded,
      answer,
      refusal_reason: grounded ? undefined : "Model returned no citation markers — treating as ungrounded.",
      figure,
      citations,
      revisions,
      provenance: {
        ingest_runs: chunks.length,
        last_ingested_at: null,
        reviewers: [],
      },
    };
  });

// ─── Figure snapshots (immutable pins) ────────────────────────────────────────

const PinInput = z.object({
  countryCode: z.string().min(3).max(4),
  figureKind: z.enum(["sector_share", "cbi_exposure", "series_point", "composition_total", "capital_flow"]),
  figureRef: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
  label: z.string().min(1).max(240),
  value: z.number().nullable().optional(),
  unit: z.string().max(64).nullable().optional(),
  confidenceGrade: z.string().max(1).nullable().optional(),
  scope: z.enum(["personal", "scenario", "brief"]).default("personal"),
  scopeRef: z.string().uuid().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  aiExplanation: z.string().max(4000).nullable().optional(),
  citations: z.array(z.record(z.string(), z.unknown())).default([]),
  sourceSnapshot: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const pinFigureSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PinInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("figure_snapshots")
      .insert({
        country_code: data.countryCode,
        figure_kind: data.figureKind,
        figure_ref: data.figureRef as unknown as Json,
        label: data.label,
        value: data.value ?? null,
        unit: data.unit ?? null,
        confidence_grade: data.confidenceGrade ?? null,
        scope: data.scope,
        scope_ref: data.scopeRef ?? null,
        note: data.note ?? null,
        ai_explanation: data.aiExplanation ?? null,
        citations: data.citations as unknown as Json,
        source_snapshot: data.sourceSnapshot as unknown as Json,
        created_by: context.userId,
      } as never)
      .select("id,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const ListSnapshotsInput = z.object({
  countryCode: z.string().min(3).max(4),
  scope: z.enum(["personal", "scenario", "brief", "all"]).default("all"),
  limit: z.number().min(1).max(200).default(50),
});

export const listFigureSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListSnapshotsInput.parse(data))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("figure_snapshots")
      .select("id,country_code,figure_kind,figure_ref,value,unit,confidence_grade,note,scope,scope_ref,ai_explanation,citations,created_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.scope !== "all") q = q.eq("scope", data.scope);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Ledger enrichment (Phase 2 — time-scrubber, peers, flows, ministries) ────
//
// Single aggregate call for the ledger home. All reads pass through the
// user's RLS. Empty tables (e.g. no exposure history yet) resolve to empty
// arrays and the UI degrades gracefully.

export interface LedgerEnrichment {
  exposureHistory: Array<{ period: string; value: number; confidence_grade: string }>;
  capitalFlowsPeriods: string[];
  capitalFlows: {
    period: string | null;
    nodes: Array<{
      node_key: string;
      label: string;
      side: "input" | "output" | "hub" | "residual";
      sector_code: string | null;
    }>;
    values: Array<{ node_key: string; value_usd_m: number; confidence_grade: string }>;
    totals: { inputs: number; outputs: number; residual: number };
  };
  ministries: Array<{
    id: string;
    slug: string;
    name: string;
    sectors: Array<{ sector_code: string; weight: number }>;
  }>;
  peerComposition: Array<{
    country_code: string;
    country_name: string;
    is_cbi_state: boolean;
    top_sector_code: string;
    top_sector_share: number;
    grade: string;
  }>;
  recentRevisions: Array<{
    id: string;
    created_at: string;
    reason: string | null;
    period: string | null;
    previous_value: number | null;
    new_value: number | null;
    metric: string | null;
    sector_code: string | null;
  }>;
}

export const getLedgerEnrichment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<LedgerEnrichment> => {
    const { supabase } = context;
    const cc = data.countryCode;

    const [
      { data: exposure },
      { data: flowNodes },
      { data: flowValues },
      { data: ministriesRows },
      { data: peerSectors },
      { data: peerCountries },
      { data: seriesRows },
    ] = await Promise.all([
      supabase
        .from("exposure_index")
        .select("period,value,confidence_grade")
        .eq("country_code", cc)
        .order("period", { ascending: true }),
      supabase
        .from("capital_flow_nodes")
        .select("node_key,label,side,sector_code,sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("country_capital_flows")
        .select("node_key,period,value_usd_m,confidence_grade")
        .eq("country_code", cc)
        .order("period", { ascending: false }),
      supabase
        .from("ministries")
        .select("id,slug,name,sort_order")
        .eq("country_code", cc)
        .order("sort_order", { ascending: true }),
      supabase
        .from("country_sectors")
        .select("country_code,sector_code,share_pct,confidence_grade"),
      supabase
        .from("countries")
        .select("code,name,is_cbi_state"),
      supabase
        .from("series")
        .select("id,metric,sector_code")
        .eq("country_code", cc),
    ]);

    // Ministry × sector matrix
    const ministryIds = (ministriesRows ?? []).map((m) => m.id);
    const { data: msRows } = ministryIds.length
      ? await supabase
          .from("ministry_sectors")
          .select("ministry_id,sector_code,weight")
          .in("ministry_id", ministryIds)
      : { data: [] as Array<{ ministry_id: string; sector_code: string; weight: number }> };
    const ministries = (ministriesRows ?? []).map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      sectors: (msRows ?? [])
        .filter((r) => r.ministry_id === m.id)
        .map((r) => ({ sector_code: r.sector_code, weight: Number(r.weight ?? 1) })),
    }));

    // Capital flows: latest period only
    const periods = Array.from(new Set((flowValues ?? []).map((v) => v.period))).sort((a, b) =>
      b.localeCompare(a),
    );
    const latestPeriod = periods[0] ?? null;
    const latestValues = latestPeriod
      ? (flowValues ?? []).filter((v) => v.period === latestPeriod)
      : [];
    const sideByKey = new Map((flowNodes ?? []).map((n) => [n.node_key, n.side as string]));
    let sumIn = 0;
    let sumOut = 0;
    for (const v of latestValues) {
      const s = sideByKey.get(v.node_key);
      if (s === "input") sumIn += Number(v.value_usd_m);
      else if (s === "output") sumOut += Number(v.value_usd_m);
    }

    // Peer composition: top sector per country from peer set
    const countryByCode = new Map(
      (peerCountries ?? []).map((c) => [c.code, { name: c.name, cbi: c.is_cbi_state }]),
    );
    const groupedPeers = new Map<
      string,
      Array<{ sector_code: string; share_pct: number; confidence_grade: string }>
    >();
    for (const r of peerSectors ?? []) {
      const arr = groupedPeers.get(r.country_code) ?? [];
      arr.push({
        sector_code: r.sector_code,
        share_pct: Number(r.share_pct),
        confidence_grade: r.confidence_grade,
      });
      groupedPeers.set(r.country_code, arr);
    }
    const peerComposition: LedgerEnrichment["peerComposition"] = [];
    for (const [code, rows] of groupedPeers) {
      const meta = countryByCode.get(code);
      if (!meta) continue;
      const top = rows.slice().sort((a, b) => b.share_pct - a.share_pct)[0];
      if (!top) continue;
      peerComposition.push({
        country_code: code,
        country_name: meta.name,
        is_cbi_state: meta.cbi,
        top_sector_code: top.sector_code,
        top_sector_share: top.share_pct,
        grade: top.confidence_grade,
      });
    }
    peerComposition.sort((a, b) => Number(b.is_cbi_state) - Number(a.is_cbi_state));

    // Recent revisions across this country's series
    const seriesIds = (seriesRows ?? []).map((s) => s.id);
    const seriesMeta = new Map(
      (seriesRows ?? []).map((s) => [s.id, { metric: s.metric, sector_code: s.sector_code }]),
    );
    const { data: revs } = seriesIds.length
      ? await supabase
          .from("data_revisions")
          .select("id,series_id,created_at,reason,period,previous_value,new_value")
          .in("series_id", seriesIds)
          .order("created_at", { ascending: false })
          .limit(8)
      : { data: [] as Array<{
          id: string;
          series_id: string;
          created_at: string;
          reason: string | null;
          period: string | null;
          previous_value: number | null;
          new_value: number | null;
        }> };

    return {
      exposureHistory: (exposure ?? []).map((e) => ({
        period: e.period,
        value: Number(e.value),
        confidence_grade: e.confidence_grade,
      })),
      capitalFlowsPeriods: periods,
      capitalFlows: {
        period: latestPeriod,
        nodes: (flowNodes ?? []).map((n) => ({
          node_key: n.node_key,
          label: n.label,
          side: n.side as "input" | "output" | "hub" | "residual",
          sector_code: n.sector_code ?? null,
        })),
        values: latestValues.map((v) => ({
          node_key: v.node_key,
          value_usd_m: Number(v.value_usd_m),
          confidence_grade: v.confidence_grade,
        })),
        totals: { inputs: sumIn, outputs: sumOut, residual: sumIn - sumOut },
      },
      ministries,
      peerComposition,
      recentRevisions: (revs ?? []).map((r) => {
        const meta = r.series_id ? seriesMeta.get(r.series_id as string) : undefined;
        return {
          id: r.id,
          created_at: r.created_at,
          reason: r.reason,
          period: r.period,
          previous_value: r.previous_value !== null ? Number(r.previous_value) : null,
          new_value: r.new_value !== null ? Number(r.new_value) : null,
          metric: meta?.metric ?? null,
          sector_code: meta?.sector_code ?? null,
        };
      }),
    };
  });

// ─── Phase 3 — Trust signals ─────────────────────────────────────────────────
//
// Freshness meter, grade-downgrade alerts, and citation coverage. All reads
// under the caller's RLS. Empty tables degrade gracefully.

export interface TrustSignals {
  freshness: {
    total: number;
    stale: number;           // > 365 days
    aging: number;           // 180..365
    fresh: number;           // < 180
    unknown: number;         // no points yet
    worst: Array<{
      series_id: string;
      sector_code: string | null;
      metric: string;
      last_period: string | null;
      age_days: number | null;
      confidence_grade: string;
    }>;
  };
  gradeAlerts: Array<{
    id: string;
    sector_code: string | null;
    series_id: string | null;
    previous_grade: string | null;
    new_grade: string;
    reason: string | null;
    created_at: string;
    acknowledged_at: string | null;
  }>;
  citationCoverage: {
    total_dossiers: number;
    with_citations: number;
    coverage_pct: number;
    per_sector: Array<{ sector_code: string; total: number; with_citations: number }>;
    unbacked: Array<{ id: string; sector_code: string; kind: string }>;
  };
}

export const getTrustSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<TrustSignals> => {
    const { supabase } = context;
    const cc = data.countryCode;

    const [{ data: freshRows }, { data: alertRows }, { data: dossierRows }] = await Promise.all([
      supabase
        .from("series_freshness")
        .select("series_id,sector_code,metric,last_period,age_days,confidence_grade")
        .eq("country_code", cc),
      supabase
        .from("grade_alerts")
        .select("id,sector_code,series_id,previous_grade,new_grade,reason,created_at,acknowledged_at")
        .eq("country_code", cc)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("sector_dossiers")
        .select("id,sector_code,kind,citations")
        .eq("country_code", cc),
    ]);

    // Freshness roll-up
    let stale = 0, aging = 0, fresh = 0, unknown = 0;
    const scored = (freshRows ?? []).map((r) => ({
      series_id: r.series_id as string,
      sector_code: (r.sector_code as string | null) ?? null,
      metric: (r.metric as string) ?? "",
      last_period: (r.last_period as string | null) ?? null,
      age_days: r.age_days === null ? null : Number(r.age_days),
      confidence_grade: (r.confidence_grade as string) ?? "D",
    }));
    for (const r of scored) {
      if (r.age_days === null) unknown++;
      else if (r.age_days > 365) stale++;
      else if (r.age_days > 180) aging++;
      else fresh++;
    }
    const worst = scored
      .filter((r) => r.age_days !== null)
      .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0))
      .slice(0, 6);

    // Citation coverage per sector dossier
    const perSectorMap = new Map<string, { total: number; with_citations: number }>();
    const unbacked: TrustSignals["citationCoverage"]["unbacked"] = [];
    let withCit = 0;
    for (const d of dossierRows ?? []) {
      const arr = Array.isArray(d.citations) ? (d.citations as unknown[]) : [];
      const has = arr.length > 0;
      if (has) withCit++;
      else unbacked.push({ id: d.id as string, sector_code: d.sector_code as string, kind: d.kind as string });
      const key = d.sector_code as string;
      const entry = perSectorMap.get(key) ?? { total: 0, with_citations: 0 };
      entry.total += 1;
      if (has) entry.with_citations += 1;
      perSectorMap.set(key, entry);
    }
    const total = dossierRows?.length ?? 0;

    return {
      freshness: {
        total: scored.length,
        stale, aging, fresh, unknown,
        worst,
      },
      gradeAlerts: (alertRows ?? []).map((a) => ({
        id: a.id as string,
        sector_code: (a.sector_code as string | null) ?? null,
        series_id: (a.series_id as string | null) ?? null,
        previous_grade: (a.previous_grade as string | null) ?? null,
        new_grade: a.new_grade as string,
        reason: (a.reason as string | null) ?? null,
        created_at: a.created_at as string,
        acknowledged_at: (a.acknowledged_at as string | null) ?? null,
      })),
      citationCoverage: {
        total_dossiers: total,
        with_citations: withCit,
        coverage_pct: total === 0 ? 0 : (withCit / total) * 100,
        per_sector: Array.from(perSectorMap.entries()).map(([sector_code, v]) => ({
          sector_code, total: v.total, with_citations: v.with_citations,
        })),
        unbacked: unbacked.slice(0, 20),
      },
    };
  });

const AckInput = z.object({ id: z.string().uuid() });
export const acknowledgeGradeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AckInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("grade_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Phase 4 — "Ask the Ledger" (Second-Brain-grounded Q&A) ──────────────────
//
// Persistent right-rail chat, retrieval-only. Refuses ungrounded questions.
// Non-streaming to keep server-route auth simple; Gemini flash returns in
// under two seconds for typical corpus sizes. Sibling `pinFigureSnapshot`
// captures Q/A into figure_snapshots (scope='personal' by default).

const AskInput = z.object({
  countryCode: z.string().min(3).max(4),
  question: z.string().min(3).max(500),
  sectorCode: z.string().min(2).max(64).optional(),
});

export interface LedgerStructuredAnswer {
  situation?: string;
  direct_answer: string;
  key_evidence: string[];
  so_what?: string[];
  confidence: "high" | "medium" | "low";
  caveats: string[];
  needs_research?: boolean;
}

export interface LedgerAnswer {
  grounded: boolean;
  answer: string | null;
  structured?: LedgerStructuredAnswer | null;
  refusal_reason?: string;
  citations: FigureCitation[];
  sources_used: { corpus: number; country_context: number; web: number };
  extended_with_research?: boolean;
}

// ── Helpers: embeddings, semantic search, country context, deep research ─────

async function embedQuery(query: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: query.slice(0, 4000),
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

async function perplexityDeepResearch(
  question: string,
  countryName: string,
  briefContext: string,
): Promise<{ text: string; citations: string[] } | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-reasoning-pro",
        messages: [
          {
            role: "system",
            content: `You are a McKinsey associate partner researching the economy of ${countryName}. Be precise, quantitative, cite reputable sources (IMF, World Bank, national statistics, ministry sites, ECCB, CDB, credible press). Skip Wikipedia and low-authority blogs.`,
          },
          {
            role: "user",
            content: `Country brief:\n${briefContext}\n\nQuestion: ${question}\n\nAnswer in 4-8 sentences with concrete figures, dates and cited sources.`,
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const citations = Array.isArray(json.citations) ? json.citations : [];
    if (!text.trim()) return null;
    return { text, citations };
  } catch {
    return null;
  }
}

export const askTheLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AskInput.parse(data))
  .handler(async ({ data, context }): Promise<LedgerAnswer> => {
    const { supabase } = context;
    const key = process.env.LOVABLE_API_KEY;
    const tokens = tokenizeQuery(data.question);

    const { data: suppressions } = await supabase
      .from("source_suppressions")
      .select("source_id")
      .eq("scope_key", data.countryCode)
      .eq("active", true);
    const suppressed = new Set((suppressions ?? []).map((s) => s.source_id));

    // ─── Tier 1a: semantic search (embeddings) ────────────────────────────────
    type SemanticHit = {
      id: string;
      content: string;
      distance: number;
      source_url: string | null;
      source_title: string | null;
      source_org: string | null;
      source_id: string | null;
    };
    let semanticHits: SemanticHit[] = [];
    if (key) {
      const embedding = await embedQuery(data.question, key);
      if (embedding && embedding.length === 1536) {
        const { data: rows } = await supabase.rpc("country_chunks_search", {
          _country_code: data.countryCode,
          _query_embedding: `[${embedding.join(",")}]`,
          _limit: 12,
        });
        semanticHits = ((rows as SemanticHit[] | null) ?? []).filter(
          (r) => !r.source_id || !suppressed.has(r.source_id),
        );
      }
    }

    // ─── Tier 1b: keyword search (fallback / augmentation) ───────────────────
    const orFilter = tokens.length
      ? tokens.map((t) => `content.ilike.%${t.replace(/[%_]/g, "")}%`).join(",")
      : null;
    let chunkQuery = supabase
      .from("country_source_chunks")
      .select("id,content,chunk_index,document_id,country_source_documents!inner(country_source_id,title,country_sources!inner(id,url,title,org,weight))")
      .eq("country_code", data.countryCode)
      .limit(40);
    if (orFilter) chunkQuery = chunkQuery.or(orFilter);
    const { data: chunkRows } = await chunkQuery;

    type ChunkRow = {
      id: string;
      content: string;
      chunk_index: number;
      country_source_documents: {
        country_source_id: string;
        title: string | null;
        country_sources: { id: string; url: string | null; title: string | null; org: string | null; weight: number | null };
      } | null;
    };

    // Merge: semantic hits (score by inverse distance) + keyword hits (score by overlap).
    type Scored = { id: string; content: string; score: number; source_id: string | null; url: string | null; title: string; org: string | null };
    const scored = new Map<string, Scored>();
    for (const h of semanticHits) {
      const sim = 1 - Math.min(1, Math.max(0, h.distance));
      scored.set(h.id, {
        id: h.id,
        content: h.content ?? "",
        score: sim * 100, // semantic weighted heavily
        source_id: h.source_id,
        url: h.source_url,
        title: h.source_title ?? "Source document",
        org: h.source_org,
      });
    }
    for (const c of ((chunkRows as unknown as ChunkRow[] | null) ?? [])) {
      const sid = c.country_source_documents?.country_sources.id ?? null;
      if (sid && suppressed.has(sid)) continue;
      const content = (c.content ?? "").toLowerCase();
      let overlap = 0;
      for (const t of tokens) if (content.includes(t)) overlap += 1;
      const w = Number(c.country_source_documents?.country_sources.weight ?? 0);
      const existing = scored.get(c.id);
      const kwScore = overlap * 10 + w;
      if (existing) {
        existing.score += kwScore;
      } else if (overlap > 0) {
        scored.set(c.id, {
          id: c.id,
          content: c.content ?? "",
          score: kwScore,
          source_id: sid,
          url: c.country_source_documents?.country_sources.url ?? null,
          title:
            c.country_source_documents?.country_sources.title ??
            c.country_source_documents?.title ??
            "Source document",
          org: c.country_source_documents?.country_sources.org ?? null,
        });
      }
    }

    // Dedupe max 2 per source, cap at 8 chunks.
    const perSource = new Map<string, number>();
    const pickedChunks: Scored[] = [];
    for (const s of Array.from(scored.values()).sort((a, b) => b.score - a.score)) {
      const key = s.source_id ?? s.id;
      const used = perSource.get(key) ?? 0;
      if (used >= 2) continue;
      perSource.set(key, used + 1);
      pickedChunks.push(s);
      if (pickedChunks.length >= 8) break;
    }

    const chunks: FigureCitation[] = pickedChunks.map((c, i) => ({
      n: i + 1,
      kind: "chunk" as const,
      title: c.title,
      url: c.url,
      org: c.org,
      source_id: c.source_id,
      excerpt: (c.content ?? "").slice(0, 400),
    }));

    // ─── Tier 2: whole-country context (always included) ─────────────────────
    const [
      { data: countryRow },
      { data: kpiRows },
      { data: sectorRows },
      { data: dossierRows },
      { data: ministryRows },
      { data: exposureRow },
    ] = await Promise.all([
      supabase
        .from("countries")
        .select("code,name,currency,is_cbi_state,country_pack")
        .eq("code", data.countryCode)
        .maybeSingle(),
      supabase
        .from("country_kpis")
        .select("kpi_code,label,latest_value,unit,latest_period,target")
        .eq("country_code", data.countryCode)
        .limit(40),
      supabase
        .from("country_sectors")
        .select("sector_code,share_pct,confidence_grade")
        .eq("country_code", data.countryCode),
      supabase
        .from("sector_dossiers")
        .select("sector_code,payload")
        .eq("country_code", data.countryCode)
        .limit(20),
      supabase
        .from("ministry_profiles")
        .select("ministry_slug,minister,minister_profile,mandate")
        .eq("country_code", data.countryCode)
        .limit(20),
      supabase
        .from("exposure_index")
        .select("period,value,confidence_grade")
        .eq("country_code", data.countryCode)
        .order("period", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const countryName = countryRow?.name ?? data.countryCode;
    const anchors: FigureCitation[] = [];
    let anchorIdx = chunks.length;

    if (kpiRows && kpiRows.length > 0) {
      const kpiText = kpiRows
        .slice(0, 24)
        .map((k) => `${k.label ?? k.kpi_code}: ${k.latest_value ?? "—"} ${k.unit ?? ""} (${k.latest_period ?? "n/a"}${k.target != null ? `, target ${k.target}` : ""})`)
        .join("; ");
      if (kpiText) {
        anchorIdx += 1;
        anchors.push({
          n: anchorIdx,
          kind: "memory",
          title: `${countryName} — Canonical KPIs`,
          url: null,
          org: "ledger",
          source_id: null,
          excerpt: kpiText.slice(0, 1200),
        });
      }
    }

    if (sectorRows && sectorRows.length > 0) {
      const sectorText = sectorRows
        .map((s) => `${s.sector_code}: ${Number(s.share_pct).toFixed(1)}% (grade ${s.confidence_grade})`)
        .join("; ");
      anchorIdx += 1;
      anchors.push({
        n: anchorIdx,
        kind: "memory",
        title: `${countryName} — GDP Composition`,
        url: null,
        org: "ledger",
        source_id: null,
        excerpt: sectorText.slice(0, 800),
      });
    }

    if (exposureRow) {
      anchorIdx += 1;
      anchors.push({
        n: anchorIdx,
        kind: "memory",
        title: `${countryName} — Exposure Index`,
        url: null,
        org: "ledger",
        source_id: null,
        excerpt: `Period ${exposureRow.period}: ${Number(exposureRow.value).toFixed(2)} (grade ${exposureRow.confidence_grade})`,
      });
    }

    for (const d of (dossierRows ?? [])) {
      const payload = (d as { sector_code: string; payload: unknown }).payload;
      const excerpt = JSON.stringify(payload ?? {}).slice(0, 700);
      if (excerpt && excerpt !== "{}") {
        anchorIdx += 1;
        anchors.push({
          n: anchorIdx,
          kind: "memory",
          title: `Sector dossier · ${(d as { sector_code: string }).sector_code}`,
          url: null,
          org: "dossier",
          source_id: null,
          excerpt,
        });
        if (anchors.length > 12) break;
      }
    }

    for (const m of (ministryRows ?? [])) {
      const row = m as { ministry_slug: string; minister: string | null; minister_profile: unknown; mandate: string | null };
      const mp = (row.minister_profile ?? {}) as { name?: string; party?: string };
      const excerpt = [
        row.minister ? `Minister: ${row.minister}` : mp?.name ? `Minister: ${mp.name}` : null,
        mp?.party ? `Party: ${mp.party}` : null,
        row.mandate ? `Mandate: ${row.mandate}` : null,
      ].filter(Boolean).join(" · ").slice(0, 500);
      if (excerpt) {
        anchorIdx += 1;
        anchors.push({
          n: anchorIdx,
          kind: "memory",
          title: `Ministry · ${row.ministry_slug}`,
          url: null,
          org: "ministry",
          source_id: null,
          excerpt,
        });
        if (anchors.length > 20) break;
      }
    }

    let memQuery = supabase
      .from("memory_objects")
      .select("id,title,kind,sector_code,weight,payload,source_id")
      .in("scope_key", [data.countryCode, "REGIONAL"])
      .order("weight", { ascending: false })
      .limit(10);
    if (data.sectorCode) memQuery = memQuery.eq("sector_code", data.sectorCode);
    const { data: memRows } = await memQuery;
    for (const m of (memRows ?? []).slice(0, 4)) {
      if (m.source_id && suppressed.has(m.source_id)) continue;
      anchorIdx += 1;
      anchors.push({
        n: anchorIdx,
        kind: "memory",
        title: m.title,
        url: null,
        org: m.kind,
        source_id: m.source_id,
        excerpt: JSON.stringify(m.payload ?? {}).slice(0, 400),
      });
    }

    if (!key) {
      const citations = [...chunks, ...anchors].filter(
        (c) => c.title?.trim() || c.url?.trim() || c.excerpt?.trim(),
      );
      return {
        grounded: false,
        answer: null,
        refusal_reason: "AI gateway unavailable — retrieved sources only.",
        citations,
        sources_used: { corpus: chunks.length, country_context: anchors.length, web: 0 },
      };
    }

    // ─── First model pass: corpus + country context ──────────────────────────
    const buildContextBlock = (all: FigureCitation[]): string =>
      all.map((c) => `[${c.n}] (${c.kind}·${c.org ?? "n/a"}) ${c.title}\n${c.excerpt}`).join("\n\n");

    const system = [
      "ROLE: You are the National Ledger's steward. Answer like a McKinsey associate partner — precise, quantitative, disciplined, structured.",
      "",
      "EVIDENCE HIERARCHY:",
      "• CHUNK citations = primary evidence (highest weight). Every numeric/name/date claim must carry a matching [N] chunk citation when possible.",
      "• MEMORY citations = canonical country facts (KPIs, composition, dossiers, ministries). You MAY reason from these to synthesize context, framing, and 'so what' when chunks don't fully answer.",
      "• WEB citations = external research (only present when supplied). Cite with [N] like any other source.",
      "",
      "RULES:",
      "1. Answer ONLY the exact question asked; do not volunteer strategy unless asked.",
      "2. Prefer numbers over adjectives. Round consistently. State the period.",
      "3. If neither chunks nor memory contain enough to answer, set needs_research=true and write a 1-sentence provisional answer based on memory + your general knowledge of the region, flagged as low confidence.",
      "4. NEVER refuse. Always produce the best answer the available evidence supports; use caveats to flag thin evidence.",
      "5. No hedging filler ('it is important to note'). No restating the question.",
      "",
      "FORMAT: Return ONLY a JSON object (no prose, no fences) with keys:",
      "{",
      "  \"situation\": string (≤25 words framing the question in country context, cite [N] where possible),",
      "  \"direct_answer\": string (≤60 words, single crisp answer with [N] citations),",
      "  \"key_evidence\": string[] (2-4 bullets, each ≤25 words with ≥1 [N] citation when possible),",
      "  \"so_what\": string[] (0-3 bullets of implication — ≤20 words each),",
      "  \"confidence\": \"high\" | \"medium\" | \"low\",",
      "  \"caveats\": string[] (0-2 items),",
      "  \"needs_research\": boolean (true only when chunks + memory can't ground a numeric answer)",
      "}",
    ].join("\n");

    let citations: FigureCitation[] = [...chunks, ...anchors];
    let structured: LedgerStructuredAnswer | null = null;
    let extendedWithResearch = false;

    async function runModel(cits: FigureCitation[]): Promise<LedgerStructuredAnswer | null> {
      try {
        const gateway = createLovableAiGatewayProvider(key!);
        const result = await generateText({
          model: gateway("google/gemini-3.5-flash"),
          system,
          prompt: `Question: ${data.question}\n\nCONTEXT:\n${buildContextBlock(cits)}\n\nReturn ONLY the JSON object now.`,
        });
        return parseStructuredAnswer((result.text ?? "").trim());
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 429) throw new Error("Ledger AI rate limit — try again shortly.");
        if (status === 402) throw new Error("Lovable AI credits exhausted — top up in workspace billing.");
        throw err;
      }
    }

    structured = await runModel(citations);

    // ─── Tier 3: deep web research (only when the model flags it or refuses) ─
    const noCitedNumeric = structured && !/\[\d+\]/.test(structured.direct_answer);
    const modelWantsResearch = structured?.needs_research === true;
    const shouldEscalate = !structured || modelWantsResearch || noCitedNumeric || chunks.length === 0;

    if (shouldEscalate) {
      const brief = [
        `Country: ${countryName} (${data.countryCode})`,
        countryRow?.currency ? `Currency: ${countryRow.currency}` : "",
        countryRow?.is_cbi_state ? "CBI state: yes" : "",
        anchors.slice(0, 4).map((a) => `• ${a.title}: ${a.excerpt}`).join("\n"),
      ].filter(Boolean).join("\n");
      const research = await perplexityDeepResearch(data.question, countryName, brief);
      if (research) {
        extendedWithResearch = true;
        const webCitations: FigureCitation[] = research.citations.slice(0, 6).map((url, i) => {
          try {
            const u = new URL(url);
            return {
              n: citations.length + i + 1,
              kind: "web" as const,
              title: u.hostname.replace(/^www\./, ""),
              url,
              org: "web",
              source_id: null,
              excerpt: url,
            };
          } catch {
            return {
              n: citations.length + i + 1,
              kind: "web" as const,
              title: "Web source",
              url: null,
              org: "web",
              source_id: null,
              excerpt: url,
            };
          }
        });

        const researchAnchor: FigureCitation = {
          n: citations.length + webCitations.length + 1,
          kind: "web",
          title: "Deep research synthesis",
          url: null,
          org: "perplexity",
          source_id: null,
          excerpt: research.text
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/\s+/g, " ")
            .slice(0, 1400),
        };

        citations = [...citations, ...webCitations, researchAnchor];
        const secondPass = await runModel(citations);
        if (secondPass) structured = secondPass;
      }
    }

    if (!structured) {
      const prunedFallback = pruneCitations(null, "", citations);
      return {
        grounded: false,
        answer: null,
        refusal_reason: "Model returned no structured answer.",
        citations: prunedFallback.activeCitations,
        sources_used: countSourcesUsed(prunedFallback.activeCitations),
        extended_with_research: extendedWithResearch,
      };
    }

    const pruned = pruneCitations(structured, "", citations);
    const activeStructured = pruned.structured ?? structured;
    const combined = [
      activeStructured.situation ? `${activeStructured.situation}\n\n` : "",
      activeStructured.direct_answer,
      activeStructured.key_evidence.length ? "\n\nEvidence:\n" + activeStructured.key_evidence.map((e) => `• ${e}`).join("\n") : "",
      activeStructured.so_what?.length ? "\n\nSo what:\n" + activeStructured.so_what.map((e) => `• ${e}`).join("\n") : "",
    ].join("");
    const grounded = /\[\d+\]/.test(combined);

    return {
      grounded,
      answer: combined,
      structured: activeStructured,
      refusal_reason: grounded ? undefined : "Answer is provisional — no citation could be anchored.",
      citations: pruned.activeCitations,
      sources_used: countSourcesUsed(pruned.activeCitations),
      extended_with_research: extendedWithResearch,
    };
  });

function countSourcesUsed(cs: FigureCitation[]) {
  return {
    corpus: cs.filter((c) => c.kind === "chunk").length,
    country_context: cs.filter((c) => c.kind === "memory").length,
    web: cs.filter((c) => c.kind === "web" || c.kind === "citation").length,
  };
}

// Prune citations to only those actually referenced in the structured answer
// (or the fallback text), drop blank ones, and renumber sequentially so the
// [N] markers and the source list stay in lockstep.
function pruneCitations(
  s: LedgerStructuredAnswer | null,
  fallbackText: string,
  all: FigureCitation[],
): { structured: LedgerStructuredAnswer | null; activeCitations: FigureCitation[] } {
  const byN = new Map(all.map((c) => [c.n, c]));
  const isBlank = (c: FigureCitation | undefined) =>
    !c || (!c.title?.trim() && !c.url?.trim() && !c.excerpt?.trim());

  // Collect all [N] references in first-appearance order across every field.
  const orderedOld: number[] = [];
  const seen = new Set<number>();
  const scan = (txt: string | undefined | null) => {
    if (!txt) return;
    const re = /\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) {
      const n = Number(m[1]);
      if (seen.has(n)) continue;
      const c = byN.get(n);
      if (isBlank(c)) continue; // drop empties even when referenced
      seen.add(n);
      orderedOld.push(n);
    }
  };
  if (s) {
    scan(s.situation);
    scan(s.direct_answer);
    s.key_evidence.forEach(scan);
    s.so_what?.forEach(scan);
    s.caveats.forEach(scan);
  }
  scan(fallbackText);

  const remap = new Map<number, number>();
  orderedOld.forEach((oldN, i) => remap.set(oldN, i + 1));

  const rewrite = (txt: string | undefined): string | undefined => {
    if (!txt) return txt;
    return txt.replace(/\[(\d+)\]/g, (_, d) => {
      const n = Number(d);
      const mapped = remap.get(n);
      if (mapped) return `[${mapped}]`;
      // Referenced but blank/missing citation — strip the marker.
      return "";
    }).replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1");
  };

  const activeCitations: FigureCitation[] = orderedOld.map((oldN, i) => {
    const c = byN.get(oldN)!;
    return { ...c, n: i + 1 };
  });

  const structured: LedgerStructuredAnswer | null = s
    ? {
        ...s,
        situation: rewrite(s.situation),
        direct_answer: rewrite(s.direct_answer) ?? s.direct_answer,
        key_evidence: s.key_evidence.map((e) => rewrite(e) ?? e),
        so_what: s.so_what?.map((e) => rewrite(e) ?? e),
        caveats: s.caveats.map((e) => rewrite(e) ?? e),
      }
    : null;

  return { structured, activeCitations };
}



function parseStructuredAnswer(raw: string): LedgerStructuredAnswer | null {
  if (!raw) return null;
  // Strip common markdown fences.
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(s.slice(start, end + 1)) as Partial<LedgerStructuredAnswer>;
    if (typeof obj.direct_answer !== "string") return null;
    const conf = obj.confidence;
    return {
      situation: typeof obj.situation === "string" ? obj.situation.trim() : undefined,
      direct_answer: obj.direct_answer.trim(),
      key_evidence: Array.isArray(obj.key_evidence) ? obj.key_evidence.filter((x) => typeof x === "string").slice(0, 4) : [],
      so_what: Array.isArray(obj.so_what) ? obj.so_what.filter((x) => typeof x === "string").slice(0, 3) : [],
      confidence: conf === "high" || conf === "medium" || conf === "low" ? conf : "medium",
      caveats: Array.isArray(obj.caveats) ? obj.caveats.filter((x) => typeof x === "string").slice(0, 2) : [],
      needs_research: obj.needs_research === true,
    };
  } catch {
    return null;
  }
}

// ─── Voice transcription (mobile-first mic input for Ask-the-Ledger) ─────────

const TranscribeInput = z.object({
  base64: z.string().min(64),
  mime: z.string().min(3).max(64),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TranscribeInput.parse(data))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway unavailable.");

    // Decode base64 → Uint8Array → Blob for multipart upload.
    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.mime });

    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/webm;codecs=opus": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/mp3": "mp3",
    };
    const ext = extMap[data.mime.split(";")[0]] ?? "webm";

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", blob, `voice.${ext}`);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("Transcription rate limit — try again shortly.");
      if (resp.status === 402) throw new Error("Lovable AI credits exhausted.");
      throw new Error(`Transcription failed [${resp.status}]: ${text.slice(0, 200)}`);
    }
    const json = (await resp.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });

// ─── Phase 5 — Steward tools: reconciliation, source health, publish gate ────

export interface ReconciliationIssue {
  kind: "sector_shares" | "capital_flows";
  subject_key: string;
  label: string;
  residual_pct: number | null;
  detail: string;
  severity: "info" | "warn" | "error";
}

export interface ReconciliationNoteRow {
  id: string;
  subject_kind: string;
  subject_key: string;
  residual_pct: number | null;
  note: string;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
}

export interface ReconciliationReport {
  isSteward: boolean;
  issues: ReconciliationIssue[];
  notes: ReconciliationNoteRow[];
}

export const getReconciliationReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<ReconciliationReport> => {
    const { supabase, userId } = context;
    const cc = data.countryCode;

    const [{ data: stewardCheck }, { data: adminCheck }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "data_steward" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    const isSteward = Boolean(stewardCheck) || Boolean(adminCheck);

    const [{ data: sectors }, { data: flowNodes }, { data: flowValues }, { data: notes }] =
      await Promise.all([
        supabase.from("country_sectors").select("sector_code,share_pct").eq("country_code", cc),
        supabase.from("capital_flow_nodes").select("node_key,label,side"),
        supabase
          .from("country_capital_flows")
          .select("node_key,period,value_usd_m")
          .eq("country_code", cc)
          .order("period", { ascending: false }),
        supabase
          .from("reconciliation_notes")
          .select("id,subject_kind,subject_key,residual_pct,note,created_by,created_at,resolved_at")
          .eq("country_code", cc)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    const issues: ReconciliationIssue[] = [];

    // Sector share total
    const sumShares = (sectors ?? []).reduce((a, r) => a + Number(r.share_pct ?? 0), 0);
    if (sectors && sectors.length > 0) {
      const drift = sumShares - 100;
      if (Math.abs(drift) > 0.5) {
        issues.push({
          kind: "sector_shares",
          subject_key: "composition_total",
          label: "Sector shares sum",
          residual_pct: drift,
          detail: `Composition totals ${sumShares.toFixed(2)}% (off by ${drift.toFixed(2)}pp).`,
          severity: Math.abs(drift) > 5 ? "error" : "warn",
        });
      }
    }

    // Capital flows residual for latest period
    const periods = Array.from(new Set((flowValues ?? []).map((v) => v.period))).sort((a, b) =>
      b.localeCompare(a),
    );
    const latestPeriod = periods[0] ?? null;
    if (latestPeriod && flowNodes) {
      const sideByKey = new Map(flowNodes.map((n) => [n.node_key, n.side as string]));
      let sumIn = 0;
      let sumOut = 0;
      for (const v of flowValues ?? []) {
        if (v.period !== latestPeriod) continue;
        const s = sideByKey.get(v.node_key);
        if (s === "input") sumIn += Number(v.value_usd_m);
        else if (s === "output") sumOut += Number(v.value_usd_m);
      }
      if (sumIn > 0 || sumOut > 0) {
        const residualPct = sumIn > 0 ? ((sumIn - sumOut) / sumIn) * 100 : 0;
        if (Math.abs(residualPct) > 10) {
          issues.push({
            kind: "capital_flows",
            subject_key: `capital_flows:${latestPeriod}`,
            label: `Capital flows ${latestPeriod}`,
            residual_pct: residualPct,
            detail: `Inflows ${sumIn.toFixed(1)}M vs outflows ${sumOut.toFixed(1)}M (residual ${residualPct.toFixed(1)}%).`,
            severity: Math.abs(residualPct) > 25 ? "error" : "warn",
          });
        }
      }
    }

    return {
      isSteward,
      issues,
      notes: (notes ?? []).map((n) => ({
        id: n.id as string,
        subject_kind: n.subject_kind as string,
        subject_key: n.subject_key as string,
        residual_pct: n.residual_pct === null ? null : Number(n.residual_pct),
        note: n.note as string,
        created_by: n.created_by as string,
        created_at: n.created_at as string,
        resolved_at: (n.resolved_at as string | null) ?? null,
      })),
    };
  });

const ReconNoteInput = z.object({
  countryCode: z.string().min(3).max(4),
  subjectKind: z.enum(["sector_shares", "capital_flows", "other"]),
  subjectKey: z.string().min(1).max(120),
  residualPct: z.number().nullable().optional(),
  note: z.string().min(3).max(1000),
});

export const saveReconciliationNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReconNoteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSteward } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "data_steward",
    });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isSteward && !isAdmin) throw new Error("Steward role required.");
    const { error } = await supabase.from("reconciliation_notes").insert({
      country_code: data.countryCode,
      subject_kind: data.subjectKind,
      subject_key: data.subjectKey,
      residual_pct: data.residualPct ?? null,
      note: data.note,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Source Health ──────────────────────────────────────────────────────────

export interface SourceHealthRow {
  source_id: string;
  org: string;
  title: string;
  url: string | null;
  active: boolean;
  last_status: string | null;
  last_fetched_at: string | null;
  last_ok: boolean | null;
  last_http: number | null;
  last_error: string | null;
  latency_ms: number | null;
  checks_last_7d: number;
  failures_last_7d: number;
}

export interface SourceHealthReport {
  isSteward: boolean;
  rows: SourceHealthRow[];
  lastRunAt: string | null;
}

export const getSourceHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<SourceHealthReport> => {
    const { supabase, userId } = context;
    const cc = data.countryCode;
    const [{ data: stewardCheck }, { data: adminCheck }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "data_steward" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    const isSteward = Boolean(stewardCheck) || Boolean(adminCheck);

    const [{ data: sources }, { data: checks }] = await Promise.all([
      supabase
        .from("country_sources")
        .select("id,org,title,url,active,fetch_status,fetch_error,last_fetched_at")
        .eq("country_code", cc),
      supabase
        .from("source_health_checks")
        .select("source_id,checked_at,http_status,ok,latency_ms,error")
        .eq("country_code", cc)
        .gte("checked_at", new Date(Date.now() - 7 * 86400_000).toISOString())
        .order("checked_at", { ascending: false })
        .limit(500),
    ]);

    const byId = new Map<string, Array<NonNullable<typeof checks>[number]>>();
    for (const c of checks ?? []) {
      const arr = byId.get(c.source_id as string) ?? [];
      arr.push(c);
      byId.set(c.source_id as string, arr);
    }

    const rows: SourceHealthRow[] = (sources ?? []).map((s) => {
      const list = byId.get(s.id as string) ?? [];
      const latest = list[0];
      const failures = list.filter((c) => !c.ok).length;
      return {
        source_id: s.id as string,
        org: (s.org as string) ?? "",
        title: (s.title as string) ?? "",
        url: (s.url as string | null) ?? null,
        active: Boolean(s.active),
        last_status: (s.fetch_status as string | null) ?? null,
        last_fetched_at: (s.last_fetched_at as string | null) ?? null,
        last_ok: latest ? Boolean(latest.ok) : null,
        last_http: latest ? (latest.http_status as number | null) : null,
        last_error: latest ? ((latest.error as string | null) ?? (s.fetch_error as string | null)) : (s.fetch_error as string | null),
        latency_ms: latest ? (latest.latency_ms as number | null) : null,
        checks_last_7d: list.length,
        failures_last_7d: failures,
      };
    });

    const lastRunAt = (checks ?? []).reduce<string | null>((acc, c) => {
      const t = c.checked_at as string;
      return !acc || t > acc ? t : acc;
    }, null);

    return { isSteward, rows, lastRunAt };
  });

export const runSourceHealthChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSteward } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "data_steward",
    });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isSteward && !isAdmin) throw new Error("Steward role required.");

    const { data: sources } = await supabase
      .from("country_sources")
      .select("id,url,country_code")
      .eq("country_code", data.countryCode)
      .eq("active", true);

    let checked = 0;
    let ok = 0;
    for (const s of sources ?? []) {
      if (!s.url) continue;
      checked++;
      const t0 = Date.now();
      let status: number | null = null;
      let good = false;
      let err: string | null = null;
      try {
        const r = await fetch(s.url as string, { method: "HEAD", redirect: "follow" });
        status = r.status;
        good = r.ok;
      } catch (e) {
        err = e instanceof Error ? e.message : String(e);
      }
      const latency = Date.now() - t0;
      if (good) ok++;
      await supabase.from("source_health_checks").insert({
        country_code: s.country_code as string,
        source_id: s.id as string,
        http_status: status,
        ok: good,
        latency_ms: latency,
        error: err,
      });
      await supabase
        .from("country_sources")
        .update({
          last_fetched_at: new Date().toISOString(),
          fetch_status: good ? "ok" : status ? `http_${status}` : "error",
          fetch_error: err,
        })
        .eq("id", s.id as string);
    }
    return { checked, ok, failed: checked - ok };
  });

// ─── Publish Gate ────────────────────────────────────────────────────────────

export interface PublishGateReport {
  green: boolean;
  checks: Array<{ key: string; label: string; pass: boolean; detail: string }>;
}

export const getPublishGate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<PublishGateReport> => {
    const { supabase } = context;
    const cc = data.countryCode;
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");
    const t0 = Date.now();

    const [
      { data: sectors },
      { data: dossiers },
      { data: fresh },
      { data: alerts },
      { data: sources },
      { data: flowNodes },
      { data: flowRows },
    ] = await Promise.all([
      supabase.from("country_sectors").select("share_pct").eq("country_code", cc),
      supabase.from("sector_dossiers").select("citations").eq("country_code", cc),
      supabase.from("series_freshness").select("age_days").eq("country_code", cc),
      supabase
        .from("grade_alerts")
        .select("id")
        .eq("country_code", cc)
        .is("acknowledged_at", null),
      supabase
        .from("country_sources")
        .select("id,fetch_status,active")
        .eq("country_code", cc)
        .eq("active", true),
      supabase.from("capital_flow_nodes").select("node_key,side"),
      supabase
        .from("country_capital_flows")
        .select("node_key,period,value_usd_m")
        .eq("country_code", cc)
        .order("period", { ascending: false }),
    ]);

    const latency = Date.now() - t0;
    void recordCorpusReadOutcome({
      countryCode: cc, domain: "dossier", key: "publishgate:dossiers",
      outcome: (dossiers?.length ?? 0) > 0 ? "hit" : "empty",
      latencyMs: latency, actor: context.userId,
    });
    void recordCorpusReadOutcome({
      countryCode: cc, domain: "sources", key: "publishgate:sources",
      outcome: (sources?.length ?? 0) > 0 ? "hit" : "empty",
      latencyMs: latency, actor: context.userId,
    });

    const sumShares = (sectors ?? []).reduce((a, r) => a + Number(r.share_pct ?? 0), 0);
    const sharesOk = sectors && sectors.length > 0 && Math.abs(sumShares - 100) <= 0.5;

    const totalDoss = dossiers?.length ?? 0;
    const backed = (dossiers ?? []).filter(
      (d) => Array.isArray(d.citations) && (d.citations as unknown[]).length > 0,
    ).length;
    const coveragePct = totalDoss === 0 ? 0 : (backed / totalDoss) * 100;
    const coverageOk = totalDoss > 0 && coveragePct >= 95;

    const stale = (fresh ?? []).filter(
      (r) => r.age_days !== null && Number(r.age_days) > 365,
    ).length;
    const freshOk = (fresh?.length ?? 0) > 0 && stale === 0;

    const openAlerts = alerts?.length ?? 0;

    const brokenSources = (sources ?? []).filter(
      (s) => s.fetch_status && s.fetch_status !== "ok" && s.fetch_status !== "pending",
    ).length;

    const flowPeriods = Array.from(new Set((flowRows ?? []).map((r) => String(r.period ?? "")))).filter(Boolean).sort((a, b) => b.localeCompare(a));
    const flowPeriod = flowPeriods[0] ?? null;
    const latestFlows = flowPeriod ? (flowRows ?? []).filter((r) => r.period === flowPeriod) : (flowRows ?? []);
    const sideByKey = new Map((flowNodes ?? []).map((n) => [String(n.node_key), String(n.side)]));
    let flowInputs = 0;
    let flowOutputs = 0;
    let flowSumIn = 0;
    let flowSumOut = 0;
    let unknownFlowKeys = 0;
    const residualNodeKeys = new Set(["RECONCILIATION_RESIDUAL", "RECONCILIATION_INFLOW_RESIDUAL"]);
    for (const f of latestFlows) {
      const side = sideByKey.get(String(f.node_key));
      if (!side) { unknownFlowKeys += 1; continue; }
      const value = Number(f.value_usd_m ?? 0);
      if (side === "input") { if (!residualNodeKeys.has(String(f.node_key))) flowInputs += 1; flowSumIn += value; }
      if (side === "output") { if (!residualNodeKeys.has(String(f.node_key))) flowOutputs += 1; flowSumOut += value; }
    }
    const flowResidualPct = Math.max(flowSumIn, flowSumOut) > 0 ? Math.abs(flowSumIn - flowSumOut) / Math.max(flowSumIn, flowSumOut) : 1;
    const flowsOk = flowInputs >= 3 && flowOutputs >= 4 && flowResidualPct <= 0.1 && unknownFlowKeys === 0;

    const checks = [
      {
        key: "shares",
        label: "Composition reconciles to 100%",
        pass: Boolean(sharesOk),
        detail: `Sum = ${sumShares.toFixed(2)}%`,
      },
      {
        key: "coverage",
        label: "Citation coverage ≥ 95%",
        pass: coverageOk,
        detail: `${backed}/${totalDoss} dossiers backed (${coveragePct.toFixed(0)}%)`,
      },
      {
        key: "freshness",
        label: "No stale series (>365d)",
        pass: freshOk,
        detail: `${stale} stale of ${fresh?.length ?? 0}`,
      },
      {
        key: "alerts",
        label: "No un-acknowledged grade downgrades",
        pass: openAlerts === 0,
        detail: `${openAlerts} open`,
      },
      {
        key: "sources",
        label: "All active sources reachable",
        pass: brokenSources === 0,
        detail: `${brokenSources} unreachable`,
      },
      {
        key: "flows",
        label: "Capital-flow Sankey coverage",
        pass: flowsOk,
        detail: `${latestFlows.length} flows${flowPeriod ? ` (${flowPeriod})` : ""}; ${flowInputs}/6 inputs, ${flowOutputs}/6 outputs, ${(flowResidualPct * 100).toFixed(1)}% residual${unknownFlowKeys ? `, ${unknownFlowKeys} unknown keys` : ""}`,
      },
    ];
    return { green: checks.every((c) => c.pass), checks };
  });


// ─── Phase 6 — Handoffs (Counsel + Narrative) and press-safe surfaces ────────
//
// Every figure clicked in the instrument can be "spoken" into Counsel or
// Narrative with its grade, value and citations pre-loaded. Handoffs create
// an intake_items row (the Narrative signal) and, for Counsel, a paired
// dossier_questions row scoped to that signal. Both writes go through the
// user's RLS.

const HandoffInput = z.object({
  target: z.enum(["counsel", "narrative"]),
  countryCode: z.string().min(3).max(4),
  sectorCode: z.string().min(2).max(24).default("cross-cutting"),
  figureLabel: z.string().min(1).max(240),
  figureValue: z.number().nullable().optional(),
  figureUnit: z.string().max(32).nullable().optional(),
  confidenceGrade: z.string().max(1).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  citationUrl: z.string().url().nullable().optional(),
  citationTitle: z.string().max(240).nullable().optional(),
});

export const handoffFigure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => HandoffInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const scopeKey = data.countryCode.toLowerCase();
    const valueBit =
      data.figureValue !== null && data.figureValue !== undefined
        ? ` = ${data.figureValue}${data.figureUnit ? ` ${data.figureUnit}` : ""}`
        : "";
    const topic = `Speak this number — ${data.figureLabel}${valueBit}`;
    const summary =
      (data.note ? `${data.note}\n\n` : "") +
      `Figure: ${data.figureLabel}${valueBit}` +
      (data.confidenceGrade ? ` · Grade ${data.confidenceGrade}` : "") +
      (data.citationTitle ? `\nCitation: ${data.citationTitle}` : "") +
      (data.citationUrl ? `\n${data.citationUrl}` : "");

    const { data: signal, error: sigErr } = await supabase
      .from("intake_items")
      .insert({
        scope_key: scopeKey,
        sector_code: data.sectorCode,
        topic,
        summary,
        url: data.citationUrl ?? null,
        proposed_weight: 3,
        state: "pending",
      } as never)
      .select("id")
      .single();
    if (sigErr) throw new Error(sigErr.message);

    let questionId: string | null = null;
    if (data.target === "counsel") {
      const { data: q, error: qErr } = await supabase
        .from("dossier_questions")
        .insert({
          signal_id: (signal as { id: string }).id,
          scope_key: scopeKey,
          sector_code: data.sectorCode,
          question: `Brief Counsel on: ${data.figureLabel}${valueBit}. ${data.note ?? ""}`.trim(),
          status: "open",
          created_by: context.userId,
        } as never)
        .select("id")
        .single();
      if (qErr) throw new Error(qErr.message);
      questionId = (q as { id: string }).id;
    }

    return {
      target: data.target,
      signalId: (signal as { id: string }).id,
      questionId,
    };
  });
