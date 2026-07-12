// Super-admin control surface for a country's ingested data corpus.
// Sources, KPIs, sector dossiers, ministry profiles, corpus stats,
// semantic search over embedded chunks, and second-brain memory objects.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

const CodeInput = z.object({ countryCode: z.string().min(2).max(4) });

// ============================================================
// Sources
// ============================================================

export const listSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sources, error } = await supabaseAdmin
      .from("country_sources")
      .select("*")
      .eq("country_code", data.countryCode)
      .order("quality_score", { ascending: false })
      .order("kind", { ascending: true });
    if (error) throw error;

    // Attach chunk counts per source (via document→chunks)
    const { data: docs } = await supabaseAdmin
      .from("country_source_documents")
      .select("source_id, chunk_count, char_count, fetched_at")
      .eq("country_code", data.countryCode);
    const byId = new Map<string, { chunks: number; chars: number; fetched: string | null }>();
    for (const d of docs ?? []) {
      const cur = byId.get(d.source_id) ?? { chunks: 0, chars: 0, fetched: null };
      cur.chunks += d.chunk_count ?? 0;
      cur.chars += d.char_count ?? 0;
      if (!cur.fetched || (d.fetched_at && d.fetched_at > cur.fetched)) cur.fetched = d.fetched_at;
      byId.set(d.source_id, cur);
    }
    return (sources ?? []).map((s) => ({
      ...s,
      _doc_chunks: byId.get(s.id)?.chunks ?? 0,
      _doc_chars: byId.get(s.id)?.chars ?? 0,
      _doc_fetched_at: byId.get(s.id)?.fetched ?? null,
    }));
  });

const UpsertSourceInput = z.object({
  id: z.string().uuid().optional(),
  countryCode: z.string().min(2).max(4),
  url: z.string().url(),
  title: z.string().min(1),
  org: z.string().min(1),
  kind: z.string().min(2),
  quality_score: z.number().int().min(1).max(5).default(3),
  active: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

export const upsertSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertSourceInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const domain = (() => {
      try { return new URL(data.url).hostname; } catch { return null; }
    })();
    const row = {
      country_code: data.countryCode,
      url: data.url,
      title: data.title,
      org: data.org,
      kind: data.kind,
      quality_score: data.quality_score,
      active: data.active,
      tags: data.tags,
      tld: domain ? domain.split(".").slice(-1)[0] : null,
      created_by: context.userId,
    };
    const q = data.id
      ? supabaseAdmin.from("country_sources").update(row).eq("id", data.id).select("id").single()
      : supabaseAdmin.from("country_sources").upsert(row, { onConflict: "country_code,url" }).select("id").single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const toggleSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("country_sources")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cascade: delete chunks + documents for this source
    const { data: docs } = await supabaseAdmin
      .from("country_source_documents")
      .select("id")
      .eq("source_id", data.id);
    const docIds = (docs ?? []).map((d) => d.id);
    if (docIds.length) {
      await supabaseAdmin.from("country_source_chunks").delete().in("document_id", docIds);
      await supabaseAdmin.from("country_source_documents").delete().in("id", docIds);
    }
    const { error } = await supabaseAdmin.from("country_sources").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const reingestSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src, error } = await supabaseAdmin
      .from("country_sources")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !src) throw new Error("Source not found");

    const { fetchFirecrawl, chunkText, embedBatch } = await import(
      "@/lib/country-onboarding/ingest.server"
    );

    try {
      const doc = await fetchFirecrawl(src.url);
      // Replace any prior document + chunks for this source
      const { data: existing } = await supabaseAdmin
        .from("country_source_documents")
        .select("id")
        .eq("source_id", src.id);
      const eIds = (existing ?? []).map((d) => d.id);
      if (eIds.length) {
        await supabaseAdmin.from("country_source_chunks").delete().in("document_id", eIds);
        await supabaseAdmin.from("country_source_documents").delete().in("id", eIds);
      }

      const chunks = chunkText(doc.markdown);
      const { data: docRow, error: dErr } = await supabaseAdmin
        .from("country_source_documents")
        .insert({
          country_code: src.country_code,
          source_id: src.id,
          title: doc.title,
          raw_text: doc.markdown,
          chunk_count: chunks.length,
          char_count: doc.markdown.length,
        })
        .select("id")
        .single();
      if (dErr || !docRow) throw dErr ?? new Error("insert doc failed");

      // Embed in batches of 64
      for (let i = 0; i < chunks.length; i += 64) {
        const batch = chunks.slice(i, i + 64);
        const embs = await embedBatch(batch);
        const rows = batch.map((content, idx) => ({
          country_code: src.country_code,
          document_id: docRow.id,
          chunk_index: i + idx,
          content,
          embedding: `[${embs[idx].join(",")}]` as unknown as string,
        }));
        const { error: cErr } = await supabaseAdmin
          .from("country_source_chunks")
          .insert(rows);
        if (cErr) throw cErr;
      }

      await supabaseAdmin
        .from("country_sources")
        .update({
          last_fetched_at: new Date().toISOString(),
          fetch_status: "ok",
          fetch_error: null,
        })
        .eq("id", src.id);
      return { ok: true, chunks: chunks.length, chars: doc.markdown.length };
    } catch (err) {
      await supabaseAdmin
        .from("country_sources")
        .update({
          fetch_status: "error",
          fetch_error: (err as Error).message.slice(0, 500),
          last_fetched_at: new Date().toISOString(),
        })
        .eq("id", src.id);
      throw err;
    }
  });

// ============================================================
// KPIs
// ============================================================

export const listKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("country_kpis")
      .select("*, country_sources(url, title, org)")
      .eq("country_code", data.countryCode)
      .order("category", { ascending: true })
      .order("kpi_code", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const updateKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      latest_value: z.number().nullable().optional(),
      latest_period: z.string().nullable().optional(),
      target: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("country_kpis").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

// ============================================================
// Sector dossiers
// ============================================================

export const listDossiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("sector_dossiers")
      .select("*")
      .eq("country_code", data.countryCode)
      .order("sector_code", { ascending: true })
      .order("kind", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

// ============================================================
// Ministry profiles
// ============================================================

export const listMinistryProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ministry_profiles")
      .select("*, ministries!inner(name, slug)")
      .eq("country_code", data.countryCode);
    if (error) throw error;
    return rows ?? [];
  });

// ============================================================
// Corpus stats + semantic search
// ============================================================

export const corpusStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count: sourcesTotal }, { count: sourcesActive }, { count: docs }, { count: chunks }, { data: last }] =
      await Promise.all([
        supabaseAdmin.from("country_sources").select("id", { count: "exact", head: true }).eq("country_code", data.countryCode),
        supabaseAdmin.from("country_sources").select("id", { count: "exact", head: true }).eq("country_code", data.countryCode).eq("active", true),
        supabaseAdmin.from("country_source_documents").select("id", { count: "exact", head: true }).eq("country_code", data.countryCode),
        supabaseAdmin.from("country_source_chunks").select("id", { count: "exact", head: true }).eq("country_code", data.countryCode),
        supabaseAdmin.from("country_source_documents").select("fetched_at").eq("country_code", data.countryCode).order("fetched_at", { ascending: false }).limit(1),
      ]);
    return {
      sources_total: sourcesTotal ?? 0,
      sources_active: sourcesActive ?? 0,
      documents: docs ?? 0,
      chunks: chunks ?? 0,
      last_ingest_at: last?.[0]?.fetched_at ?? null,
    };
  });

export const semanticSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      countryCode: z.string().min(2).max(4),
      query: z.string().min(2).max(500),
      k: z.number().int().min(1).max(20).default(8),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { embedBatch } = await import("@/lib/country-onboarding/ingest.server");
    const [emb] = await embedBatch([data.query]);
    const vec = `[${emb.join(",")}]`;

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Use PostgREST directly with the RPC-free approach: order by embedding <=> vec
    const url = `${SUPABASE_URL}/rest/v1/country_source_chunks?country_code=eq.${data.countryCode}&select=id,chunk_index,content,document_id,country_source_documents!inner(title,source_id,country_sources!inner(url,org,title))&order=embedding.cosine.${encodeURIComponent(vec)}&limit=${data.k}`;
    // The PostgREST `order=embedding.cosine.<vec>` syntax may not be supported; fall back to a raw SQL RPC.
    // Use edge-safe: call a Postgres function via rpc.
    // We create the RPC in migration; for now, do a two-step: fetch chunks with distance via rpc.
    void url;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("country_chunks_search", {
      _country_code: data.countryCode,
      _query_embedding: vec,
      _limit: data.k,
    });
    if (error) throw error;
    return (rows ?? []) as Array<{
      id: string;
      chunk_index: number;
      content: string;
      distance: number;
      source_url: string;
      source_title: string;
      source_org: string;
    }>;
  });

// ============================================================
// Second brain memory
// ============================================================

export const listMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("memory_objects")
      .select("*")
      .in("scope_key", [data.countryCode, "national"])
      .order("verified", { ascending: false })
      .order("weight", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const upsertMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      countryCode: z.string().min(2).max(4),
      sector_code: z.string().min(2),
      kind: z.string().min(2),
      title: z.string().min(1),
      body: z.string().min(1),
      weight: z.number().int().min(1).max(5).default(3),
      verified: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      scope_key: data.countryCode,
      sector_code: data.sector_code,
      kind: data.kind,
      title: data.title,
      payload: { body: data.body } as any,
      weight: data.weight,
      verified: data.verified,
      created_by: context.userId,
    };
    const q = data.id
      ? supabaseAdmin.from("memory_objects").update(row).eq("id", data.id).select("id").single()
      : supabaseAdmin.from("memory_objects").insert(row).select("id").single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const setMemoryVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), verified: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("memory_objects").update({ verified: data.verified }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("memory_objects").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
