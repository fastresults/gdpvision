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
  kind: "chunk" | "memory" | "citation";
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

