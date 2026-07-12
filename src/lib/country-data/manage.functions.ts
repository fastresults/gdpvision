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
    const srcIds = (sources ?? []).map((s) => s.id);
    const byId = new Map<string, { chunks: number; chars: number; fetched: string | null }>();
    if (srcIds.length) {
      const { data: docs } = await supabaseAdmin
        .from("country_source_documents")
        .select("country_source_id, chunk_count, char_count, fetched_at")
        .in("country_source_id", srcIds);
      for (const d of docs ?? []) {
        const cur = byId.get(d.country_source_id) ?? { chunks: 0, chars: 0, fetched: null };
        cur.chunks += d.chunk_count ?? 0;
        cur.chars += d.char_count ?? 0;
        if (!cur.fetched || (d.fetched_at && d.fetched_at > cur.fetched)) cur.fetched = d.fetched_at;
        byId.set(d.country_source_id, cur);
      }
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
    const { upsertCountrySource } = await import("@/lib/country-data/sources.server");

    if (data.id) {
      // Explicit edit of an existing row — no dedupe rewrite
      const domain = (() => { try { return new URL(data.url).hostname; } catch { return null; } })();
      const { data: out, error } = await supabaseAdmin
        .from("country_sources")
        .update({
          url: data.url,
          title: data.title,
          org: data.org,
          kind: data.kind,
          quality_score: data.quality_score,
          active: data.active,
          tags: data.tags,
          tld: domain ? domain.split(".").slice(-1)[0] : null,
        })
        .eq("id", data.id)
        .select("id")
        .single();
      if (error) throw error;
      return out;
    }

    const result = await upsertCountrySource(supabaseAdmin, {
      country_code: data.countryCode,
      url: data.url,
      title: data.title,
      org: data.org,
      kind: data.kind,
      quality_score: data.quality_score,
      active: data.active,
      tags: data.tags,
      created_by: context.userId,
    });
    if (!result) throw new Error("Failed to upsert source");
    return { id: result.id };
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
      .eq("country_source_id", data.id);
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
        .eq("country_source_id", src.id);
      const eIds = (existing ?? []).map((d) => d.id);
      if (eIds.length) {
        await supabaseAdmin.from("country_source_chunks").delete().in("document_id", eIds);
        await supabaseAdmin.from("country_source_documents").delete().in("id", eIds);
      }

      const chunks = chunkText(doc.markdown);
      const { data: docRow, error: dErr } = await supabaseAdmin
        .from("country_source_documents")
        .insert({
          country_source_id: src.id,
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
// KPI inference: accept / override / reject / re-infer
// ============================================================

export const acceptKpiInference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), note: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("country_kpis")
      .update({
        provenance: "admin_verified",
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
        admin_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const overrideKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      latest_value: z.number(),
      latest_period: z.string().nullable().optional(),
      note: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Preserve prior inference in inference_history for audit.
    const { data: prior } = await supabaseAdmin
      .from("country_kpis")
      .select("inference_history, provenance, latest_value, inference_rationale, inference_model, inferred_at")
      .eq("id", data.id)
      .maybeSingle();
    const hist = Array.isArray(prior?.inference_history) ? (prior!.inference_history as unknown[]) : [];
    if (prior?.provenance === "inferred" && prior.latest_value != null) {
      hist.push({
        value: prior.latest_value,
        model: prior.inference_model,
        rationale: prior.inference_rationale,
        inferred_at: prior.inferred_at,
        overridden_at: new Date().toISOString(),
      });
    }
    const patch: Record<string, unknown> = {
      latest_value: data.latest_value,
      provenance: "admin_override",
      verified_by: context.userId,
      verified_at: new Date().toISOString(),
      admin_note: data.note ?? null,
      freshness_status: "fresh",
      last_verified_at: new Date().toISOString(),
      inference_history: hist.slice(-10),
    };
    if (data.latest_period !== undefined) patch.latest_period = data.latest_period;
    const { error } = await supabaseAdmin.from("country_kpis").update(patch as any).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const rejectKpiInference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), note: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("country_kpis")
      .update({
        latest_value: null,
        latest_period: null,
        freshness_status: "missing",
        provenance: "verified",
        confidence: null,
        inference_rationale: null,
        inference_evidence: null,
        inference_model: null,
        inferred_at: null,
        admin_note: data.note ?? "rejected by admin",
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const reinferKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: e0 } = await supabaseAdmin
      .from("country_kpis")
      .select("id, country_code, kpi_code")
      .eq("id", data.id)
      .single();
    if (e0 || !row) throw new Error("KPI row not found");
    const { data: country, error: e1 } = await supabaseAdmin
      .from("countries")
      .select("code, name, iso3")
      .eq("code", row.country_code)
      .single();
    if (e1 || !country) throw new Error("Country not found");

    const { findRegistryEntry } = await import("@/lib/country-onboarding/kpi-registry");
    const kpi = findRegistryEntry(row.kpi_code);
    if (!kpi) throw new Error(`KPI ${row.kpi_code} not in registry`);

    const { inferOneKpi } = await import("@/lib/country-onboarding/kpi-inference.server");
    const { result, attempt } = await inferOneKpi({
      admin: supabaseAdmin,
      country: { code: country.code, name: country.name, iso3: country.iso3 },
      kpi,
    });

    // Log the attempt.
    await supabaseAdmin.from("kpi_research_attempts").insert({
      country_code: row.country_code,
      kpi_code: row.kpi_code,
      pass: "escalation",
      provider: "lovable-ai",
      model: attempt.model,
      ok: attempt.ok,
      value: attempt.value,
      period: attempt.period,
      source_url: attempt.source_url,
      error: attempt.error ? `inference: ${attempt.error}` : null,
    });

    if (!result) return { ok: false, error: attempt.error };

    // Preserve prior in history.
    const { data: prior } = await supabaseAdmin
      .from("country_kpis")
      .select("inference_history, provenance, latest_value, inference_rationale, inference_model, inferred_at")
      .eq("id", data.id)
      .single();
    const hist = Array.isArray(prior?.inference_history) ? (prior!.inference_history as unknown[]) : [];
    if (prior?.provenance === "inferred" && prior.latest_value != null) {
      hist.push({
        value: prior.latest_value,
        model: prior.inference_model,
        rationale: prior.inference_rationale,
        inferred_at: prior.inferred_at,
      });
    }

    const { error: eUpd } = await supabaseAdmin
      .from("country_kpis")
      .update({
        latest_value: result.value,
        latest_period: result.period,
        provenance: "inferred",
        confidence: result.confidence,
        inference_rationale: result.rationale,
        inference_evidence: { assumptions: result.assumptions, evidence: result.evidence },
        inference_model: result.model,
        inferred_at: new Date().toISOString(),
        freshness_status: "fresh",
        last_verified_at: new Date().toISOString(),
        inference_history: hist.slice(-10) as any,
        verified_by: null,
        verified_at: null,
        admin_note: null,
      })
      .eq("id", data.id);
    if (eUpd) throw eUpd;
    return { ok: true };
  });

export const inferAllMissing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: country, error: eC } = await supabaseAdmin
      .from("countries")
      .select("code, name, iso3")
      .eq("code", data.countryCode)
      .single();
    if (eC || !country) throw new Error("Country not found");

    const { registryFor } = await import("@/lib/country-onboarding/kpi-registry");
    const { inferOneKpi } = await import("@/lib/country-onboarding/kpi-inference.server");
    const registry = registryFor(["all"]);

    const { data: existing } = await supabaseAdmin
      .from("country_kpis")
      .select("kpi_code, latest_value")
      .eq("country_code", data.countryCode);
    const filledSet = new Set(
      (existing ?? []).filter((r: any) => r.latest_value != null).map((r: any) => r.kpi_code as string),
    );

    let inferred = 0;
    let failed = 0;
    for (const kpi of registry) {
      if (filledSet.has(kpi.kpi_code)) continue;
      const { result, attempt } = await inferOneKpi({
        admin: supabaseAdmin,
        country: { code: country.code, name: country.name, iso3: country.iso3 },
        kpi,
      });
      await supabaseAdmin.from("kpi_research_attempts").insert({
        country_code: data.countryCode,
        kpi_code: kpi.kpi_code,
        pass: "escalation",
        provider: "lovable-ai",
        model: attempt.model,
        ok: attempt.ok,
        value: attempt.value,
        period: attempt.period,
        source_url: attempt.source_url,
        error: attempt.error ? `inference: ${attempt.error}` : null,
      });
      if (!result) {
        failed++;
        continue;
      }
      const { error: eUp } = await supabaseAdmin.from("country_kpis").upsert(
        {
          country_code: data.countryCode,
          kpi_code: kpi.kpi_code,
          label: kpi.label,
          unit: kpi.unit,
          direction: kpi.direction,
          category: kpi.category,
          latest_value: result.value,
          latest_period: result.period,
          provenance: "inferred",
          confidence: result.confidence,
          inference_rationale: result.rationale,
          inference_evidence: { assumptions: result.assumptions, evidence: result.evidence },
          inference_model: result.model,
          inferred_at: new Date().toISOString(),
          freshness_status: "fresh",
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "country_code,kpi_code" },
      );
      if (!eUp) inferred++;
      else failed++;
    }
    return { ok: true, inferred, failed };
  });

export const acceptAllHighConfidenceInferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("country_kpis")
      .update({
        provenance: "admin_verified",
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
      })
      .eq("country_code", data.countryCode)
      .eq("provenance", "inferred")
      .eq("confidence", "high")
      .select("id");
    if (error) throw error;
    return { ok: true, accepted: rows?.length ?? 0 };
  });

// ============================================================
// Source candidates (URLs the inference model suggested)
// ============================================================

export const listSourceCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("source_candidates")
      .select("*")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const approveSourceCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cand, error: e0 } = await supabaseAdmin
      .from("source_candidates")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e0 || !cand) throw new Error("Candidate not found");

    let tld: string | null = null;
    try {
      tld = new URL(cand.url).hostname.replace(/^www\./, "");
    } catch {
      throw new Error("Invalid URL on candidate");
    }
    const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
    const res = await upsertCountrySource(supabaseAdmin, {
      country_code: cand.country_code,
      url: cand.url,
      title: cand.title ?? `Suggested source (${tld})`,
      org: tld,
      kind: "kpi_source",
      tags: ["auto", "kpi", "candidate-approved"],
      quality_score: 3,
      active: true,
      created_by: context.userId,
    });
    if (!res) throw new Error("Failed to promote candidate");
    await supabaseAdmin
      .from("source_candidates")
      .update({ status: "approved", approved_by: context.userId, approved_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });


export const rejectSourceCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("source_candidates")
      .update({ status: "rejected", approved_by: context.userId, approved_at: new Date().toISOString() })
      .eq("id", data.id);
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
      .select("*")
      .eq("country_code", data.countryCode);
    if (error) throw error;
    const slugs = Array.from(new Set((rows ?? []).map((r) => r.ministry_slug).filter(Boolean)));
    const { data: mins } = slugs.length
      ? await supabaseAdmin.from("ministries").select("slug,name").in("slug", slugs)
      : { data: [] as Array<{ slug: string; name: string }> };
    const byslug = new Map((mins ?? []).map((m) => [m.slug, m]));
    return (rows ?? []).map((r) => ({ ...r, ministries: byslug.get(r.ministry_slug) ?? null }));
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

    const [{ count: sourcesTotal }, { count: sourcesActive }, { data: srcRows }, { count: chunks }] =
      await Promise.all([
        supabaseAdmin.from("country_sources").select("id", { count: "exact", head: true }).eq("country_code", data.countryCode),
        supabaseAdmin.from("country_sources").select("id", { count: "exact", head: true }).eq("country_code", data.countryCode).eq("active", true),
        supabaseAdmin.from("country_sources").select("id").eq("country_code", data.countryCode),
        supabaseAdmin.from("country_source_chunks").select("id", { count: "exact", head: true }).eq("country_code", data.countryCode),
      ]);
    const srcIds = (srcRows ?? []).map((s) => s.id);
    let documents = 0;
    let last_ingest_at: string | null = null;
    if (srcIds.length) {
      const [{ count: d }, { data: latest }] = await Promise.all([
        supabaseAdmin.from("country_source_documents").select("id", { count: "exact", head: true }).in("country_source_id", srcIds),
        supabaseAdmin.from("country_source_documents").select("fetched_at").in("country_source_id", srcIds).order("fetched_at", { ascending: false }).limit(1),
      ]);
      documents = d ?? 0;
      last_ingest_at = latest?.[0]?.fetched_at ?? null;
    }
    return {
      sources_total: sourcesTotal ?? 0,
      sources_active: sourcesActive ?? 0,
      documents,
      chunks: chunks ?? 0,
      last_ingest_at,
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin.rpc as any)("country_chunks_search", {
      _country_code: data.countryCode,
      _query_embedding: vec,
      _limit: data.k,
    });
    if (error) throw error;
    return ((rows ?? []) as unknown) as Array<{
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

// ============================================================
// Source detail + summary + connections + bulk add + documents
// ============================================================

export const getSourceDetail = createServerFn({ method: "POST" })
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

    const [{ data: docs }, { data: kpis }, { data: conn }] = await Promise.all([
      supabaseAdmin
        .from("country_source_documents")
        .select("id, chunk_count, char_count, fetched_at, raw_text")
        .eq("country_source_id", data.id)
        .order("fetched_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("country_kpis")
        .select("id, kpi_code, label")
        .eq("source_id", data.id)
        .limit(50),
      supabaseAdmin
        .from("country_source_connections")
        .select("*")
        .eq("country_source_id", data.id)
        .maybeSingle(),
    ]);

    return {
      source: src,
      documents: (docs ?? []).map((d) => ({
        id: d.id,
        chunk_count: d.chunk_count,
        char_count: d.char_count,
        fetched_at: d.fetched_at,
      })),
      kpis: kpis ?? [],
      connection: conn ?? null,
      sample_excerpts: (docs ?? [])
        .slice(0, 3)
        .map((d) => (d.raw_text ? String(d.raw_text).slice(0, 900) : ""))
        .filter(Boolean),
    };
  });

export const summarizeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), force: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src, error } = await supabaseAdmin
      .from("country_sources")
      .select("id, country_code, url, title, org, kind, summary, summary_generated_at, tags")
      .eq("id", data.id)
      .single();
    if (error || !src) throw new Error("Source not found");
    if (src.summary && !data.force) {
      return { summary: src.summary, cached: true };
    }
    const { data: country } = await supabaseAdmin
      .from("countries")
      .select("name")
      .eq("code", src.country_code)
      .single();
    const { data: docs } = await supabaseAdmin
      .from("country_source_documents")
      .select("raw_text")
      .eq("country_source_id", src.id)
      .limit(3);
    const chunks: string[] = (docs ?? [])
      .map((d) => (d.raw_text ? String(d.raw_text).slice(0, 900) : ""))
      .filter(Boolean);

    const { summarizeSourceWithAi } = await import("@/lib/country-data/sources.server");
    const res = await summarizeSourceWithAi({
      title: src.title,
      org: src.org,
      url: src.url,
      kind: src.kind,
      countryName: country?.name ?? src.country_code,
      chunks,
    });
    if (!res) throw new Error("AI summary unavailable");

    const nextTags = Array.from(new Set([...(src.tags ?? []), ...res.data_types])).slice(0, 20);
    await supabaseAdmin
      .from("country_sources")
      .update({
        summary: res.summary,
        summary_generated_at: new Date().toISOString(),
        tags: nextTags,
      })
      .eq("id", src.id);
    return { summary: res.summary, cached: false, data_types: res.data_types };
  });

const BulkLinksInput = z.object({
  countryCode: z.string().min(2).max(4),
  urls: z.array(z.string().url()).min(1).max(50),
  kind: z.string().default("gov"),
  quality_score: z.number().int().min(1).max(5).default(3),
});

export const bulkAddLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkLinksInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
    let added = 0;
    let duplicates = 0;
    const errors: Array<{ url: string; error: string }> = [];
    for (const url of data.urls) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        const org = host.split(".").slice(-2, -1)[0]?.replace(/^\w/, (c) => c.toUpperCase()) ?? host;
        const res = await upsertCountrySource(supabaseAdmin, {
          country_code: data.countryCode,
          url,
          title: host,
          org,
          kind: data.kind,
          quality_score: data.quality_score,
          active: true,
          tags: ["bulk"],
          created_by: context.userId,
        });
        if (!res) errors.push({ url, error: "insert failed" });
        else if (res.existed) duplicates++;
        else added++;
      } catch (e: any) {
        errors.push({ url, error: e?.message ?? String(e) });
      }
    }
    return { added, duplicates, errors };
  });

const RegisterConnectionInput = z.object({
  countryCode: z.string().min(2).max(4),
  connection_kind: z.enum(["api", "mcp"]),
  title: z.string().min(1),
  org: z.string().min(1),
  endpoint_url: z.string().url(),
  auth_header_name: z.string().optional().nullable(),
  secret_ref: z.string().optional().nullable(),
  config: z.record(z.any()).optional(),
});

export const registerConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RegisterConnectionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
    const res = await upsertCountrySource(supabaseAdmin, {
      country_code: data.countryCode,
      url: data.endpoint_url,
      title: data.title,
      org: data.org,
      kind: data.connection_kind,
      connection_kind: data.connection_kind,
      quality_score: 4,
      active: true,
      tags: [data.connection_kind],
      created_by: context.userId,
    });
    if (!res) throw new Error("Failed to create source");
    await supabaseAdmin
      .from("country_source_connections")
      .upsert(
        {
          country_source_id: res.id,
          kind: data.connection_kind,
          endpoint_url: data.endpoint_url,
          auth_header_name: data.auth_header_name ?? null,
          secret_ref: data.secret_ref ?? null,
          config: data.config ?? {},
        },
        { onConflict: "country_source_id" },
      );
    return { id: res.id, existed: res.existed };
  });

const UploadDocInput = z.object({
  countryCode: z.string().min(2).max(4),
  filename: z.string().min(1),
  mime_type: z.string().min(1),
  content_b64: z.string().min(1),
  title: z.string().optional(),
  org: z.string().optional(),
});

export const ingestDocumentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadDocInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertCountrySource } = await import("@/lib/country-data/sources.server");

    // Upload the raw file to the country-sources bucket.
    const bytes = Buffer.from(data.content_b64, "base64");
    const safeName = data.filename.replace(/[^a-z0-9._-]/gi, "_");
    const storagePath = `${data.countryCode}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("country-sources")
      .upload(storagePath, bytes, { contentType: data.mime_type, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const title = data.title || data.filename;
    const org = data.org || "Uploaded document";
    const virtualUrl = `lovable-storage://country-sources/${storagePath}`;

    const res = await upsertCountrySource(supabaseAdmin, {
      country_code: data.countryCode,
      url: virtualUrl,
      title,
      org,
      kind: "document",
      connection_kind: "document",
      storage_path: storagePath,
      quality_score: 4,
      active: true,
      tags: ["upload", data.mime_type.split("/")[1] ?? "doc"],
      created_by: context.userId,
    });
    if (!res) throw new Error("Failed to register document source");

    // Extract text from common types (best-effort) and chunk/embed.
    let text = "";
    try {
      if (data.mime_type === "text/plain" || data.mime_type === "text/markdown" || safeName.endsWith(".md") || safeName.endsWith(".txt")) {
        text = bytes.toString("utf8");
      } else if (data.mime_type === "application/pdf") {
        const pdfParse: any = await import("pdf-parse" as any).then((m: any) => m.default ?? m).catch(() => null);
        if (pdfParse) {
          const out = await pdfParse(bytes);
          text = out?.text ?? "";
        }
      } else if (
        data.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        safeName.endsWith(".docx")
      ) {
        const mammoth: any = await import("mammoth" as any).catch(() => null);
        if (mammoth?.extractRawText) {
          const out = await mammoth.extractRawText({ buffer: bytes });
          text = out?.value ?? "";
        }
      }
    } catch {
      // best-effort — leave text empty
    }

    if (text.trim().length > 0) {
      const { chunkText, embedBatch } = await import("@/lib/country-onboarding/ingest.server");
      const chunks = chunkText(text);
      const { data: docRow, error: dErr } = await supabaseAdmin
        .from("country_source_documents")
        .insert({
          country_source_id: res.id,
          raw_text: text,
          chunk_count: chunks.length,
          char_count: text.length,
        })
        .select("id")
        .single();
      if (!dErr && docRow) {
        for (let i = 0; i < chunks.length; i += 64) {
          const batch = chunks.slice(i, i + 64);
          const embs = await embedBatch(batch);
          const rows = batch.map((content, idx) => ({
            country_code: data.countryCode,
            document_id: docRow.id,
            chunk_index: i + idx,
            content,
            embedding: `[${embs[idx].join(",")}]` as unknown as string,
          }));
          await supabaseAdmin.from("country_source_chunks").insert(rows);
        }
        await supabaseAdmin
          .from("country_sources")
          .update({ last_fetched_at: new Date().toISOString(), fetch_status: "ok" })
          .eq("id", res.id);
      }
    }
    return { id: res.id, existed: res.existed, extracted_chars: text.length };
  });

