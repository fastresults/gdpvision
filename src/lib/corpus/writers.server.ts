// Centralized, idempotent write-back for every corpus domain.
// The gateway's writeBack callbacks should call these; new code should not
// re-inline table upserts.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertCountrySource as upsertCountrySourceImpl } from "@/lib/country-data/sources.server";
import type { Json } from "@/integrations/supabase/types";
import type { CorpusCitation } from "./types";

type DbErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function dbErrorMessage(error: DbErrorLike): string {
  return [error.message, error.code ? `code=${error.code}` : null, error.details, error.hint]
    .filter(Boolean)
    .join(" · ");
}

function assertDbOk(result: { error?: DbErrorLike | null }, label: string): void {
  if (result.error) throw new Error(`${label} failed: ${dbErrorMessage(result.error)}`);
}

function assertDbRow<T>(result: { data?: T | null; error?: DbErrorLike | null }, label: string): NonNullable<T> {
  assertDbOk(result, label);
  if (!result.data) throw new Error(`${label} failed: no row returned after write`);
  return result.data as NonNullable<T>;
}

// Re-export the canonical sources upsert.
export const upsertCountrySource = upsertCountrySourceImpl;

// --- Memory objects -------------------------------------------------------
// Dedup on (scope_key, kind, title). Existing rows are updated in place
// (weight bumped, payload merged), never duplicated.
export type MemoryObjectInput = {
  scope_key: string;
  kind: string;
  title: string;
  payload?: unknown;
  weight?: number;
  sector_code?: string | null;
  source_id?: string | null;
};

export async function upsertMemoryObject(
  input: MemoryObjectInput,
): Promise<{ id: string; existed: boolean } | null> {
  const { data: existing } = await supabaseAdmin
    .from("memory_objects")
    .select("id, weight, payload")
    .eq("scope_key", input.scope_key)
    .eq("kind", input.kind)
    .eq("title", input.title)
    .maybeSingle();

  const sectorCode = input.sector_code ?? "cross";
  const payload = (input.payload ?? {}) as Json;

  if (existing?.id) {
    const res = await supabaseAdmin
      .from("memory_objects")
      .update({
        weight: Math.max(Number(existing.weight ?? 0), input.weight ?? 1),
        payload,
        sector_code: sectorCode,
        ...(input.source_id !== undefined ? { source_id: input.source_id } : {}),
      })
      .eq("id", existing.id);
    assertDbOk(res, "update memory_object");
    return { id: existing.id as string, existed: true };
  }

  const created = assertDbRow<{ id: string }>(await supabaseAdmin
    .from("memory_objects")
    .insert({
      scope_key: input.scope_key,
      kind: input.kind,
      title: input.title,
      payload,
      weight: input.weight ?? 1,
      sector_code: sectorCode,
      ...(input.source_id ? { source_id: input.source_id } : {}),
    })
    .select("id")
    .single(), "insert memory_object");
  return { id: created.id as string, existed: false };
}

export async function upsertMemoryObjects(
  inputs: MemoryObjectInput[],
): Promise<number> {
  let n = 0;
  for (const input of inputs) {
    const r = await upsertMemoryObject(input);
    if (r) n += 1;
  }
  return n;
}

// --- Provenance breadcrumb -----------------------------------------------
// The existing `data_revisions` table is scoped to numeric series changes,
// so we log corpus-fallback provenance to `corpus_fetch_attempts` (the
// gateway already does this). This helper is kept as a no-op stub for
// callers that want a domain-level breadcrumb in future work.
export async function recordFallbackRevision(_params: {
  country_code: string;
  entity: string;
  entity_id?: string | null;
  tier: string;
  citations: CorpusCitation[];
}): Promise<void> {
  // Intentionally empty — `corpus_fetch_attempts` is the audit trail.
}

// --- KPI + KPI points ----------------------------------------------------
// Idempotent upsert on (country_code, kpi_code). Delegates source dedup to
// upsertCountrySource so re-runs cannot spawn duplicate provider rows.
export type KpiWriteInput = {
  country_code: string;
  kpi_code: string;
  label: string;
  unit: string;
  direction?: string;
  category?: string;
  latest_value: number | null;
  latest_period: string | null;
  target?: number | null;
  notes?: string | null;
  source_url?: string | null;
  source_org?: string | null;
  tier?: string;
};

export async function upsertKpi(
  input: KpiWriteInput,
): Promise<{ id: string | null; source_id: string | null }> {
  let source_id: string | null = null;
  if (input.source_url) {
    const src = await upsertCountrySource(supabaseAdmin, {
      country_code: input.country_code,
      url: input.source_url,
      title: input.source_org ? `${input.source_org} — KPI source` : "Auto — KPI source",
      org: input.source_org ?? "Auto",
      kind: "kpi_source",
      tags: ["auto", "kpi", "corpus-fallback"],
      quality_score: 3,
      active: true,
    });
    source_id = src?.id ?? null;
  }

  const row = {
    country_code: input.country_code,
    kpi_code: input.kpi_code,
    label: input.label,
    unit: input.unit,
    direction: input.direction ?? "up",
    category: input.category ?? "macro",
    source_id,
    source_url: input.source_url ?? null,
    latest_value: input.latest_value,
    latest_period: input.latest_period,
    target: input.target ?? null,
    notes: input.notes ?? null,
    freshness_status: input.latest_value == null ? "missing" : "fresh",
    last_verified_at: new Date().toISOString(),
    provenance: input.tier ? `corpus-fallback:${input.tier}` : "verified",
  };

  const { data, error } = await supabaseAdmin
    .from("country_kpis")
    .upsert(row as never, { onConflict: "country_code,kpi_code" })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`upsert KPI ${input.kpi_code} failed: ${dbErrorMessage(error)}`);
  if (!data) throw new Error(`upsert KPI ${input.kpi_code} failed: no row returned after write`);
  return { id: data.id as string, source_id };
}

export async function upsertKpiPoint(input: {
  country_kpi_id: string;
  period: string;
  value: number;
  source_id?: string | null;
  source_url?: string | null;
}): Promise<void> {
  // Dedup on (country_kpi_id, period).
  const { data: existing } = await supabaseAdmin
    .from("country_kpi_points")
    .select("id")
    .eq("country_kpi_id", input.country_kpi_id)
    .eq("period", input.period)
    .maybeSingle();
  if (existing?.id) {
    const res = await supabaseAdmin
      .from("country_kpi_points")
      .update({
        value: input.value,
        source_id: input.source_id ?? null,
        source_url: input.source_url ?? null,
      })
      .eq("id", existing.id);
    assertDbOk(res, "update KPI point");
    return;
  }
  assertDbOk(await supabaseAdmin.from("country_kpi_points").insert({
    country_kpi_id: input.country_kpi_id,
    period: input.period,
    value: input.value,
    source_id: input.source_id ?? null,
    source_url: input.source_url ?? null,
  }), "insert KPI point");
}

// --- Sector dossier -------------------------------------------------------
// Dedup on (country_code, sector_code, kind).
export async function upsertSectorDossier(input: {
  country_code: string;
  sector_code: string;
  kind: string;
  payload: unknown;
  citations?: CorpusCitation[];
  confidence?: string;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("sector_dossiers")
    .select("id")
    .eq("country_code", input.country_code)
    .eq("sector_code", input.sector_code)
    .eq("kind", input.kind)
    .maybeSingle();
  const row = {
    payload: (input.payload ?? {}) as Json,
    citations: (input.citations ?? []) as unknown as Json,
    confidence: input.confidence ?? "medium",
    updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    assertDbOk(await supabaseAdmin.from("sector_dossiers").update(row).eq("id", existing.id), "update sector dossier");
    return;
  }
  assertDbOk(await supabaseAdmin.from("sector_dossiers").insert({
    country_code: input.country_code,
    sector_code: input.sector_code,
    kind: input.kind,
    ...row,
  }), "insert sector dossier");
}

// --- Ministry profile -----------------------------------------------------
// Dedup on (country_code, ministry_slug).
export async function upsertMinistryProfile(input: {
  country_code: string;
  ministry_slug: string;
  minister?: string | null;
  minister_profile?: unknown;
  mandate?: string | null;
  programmes?: unknown;
  citations?: CorpusCitation[];
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("ministry_profiles")
    .select("id")
    .eq("country_code", input.country_code)
    .eq("ministry_slug", input.ministry_slug)
    .maybeSingle();
  const row = {
    minister: input.minister ?? null,
    minister_profile: (input.minister_profile ?? {}) as Json,
    mandate: input.mandate ?? null,
    programmes: (input.programmes ?? []) as Json,
    citations: (input.citations ?? []) as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    assertDbOk(await supabaseAdmin.from("ministry_profiles").update(row).eq("id", existing.id), "update ministry profile");
    return;
  }
  assertDbOk(await supabaseAdmin.from("ministry_profiles").insert({
    country_code: input.country_code,
    ministry_slug: input.ministry_slug,
    ...row,
  }), "insert ministry profile");
}

// --- Capital flow value ---------------------------------------------------
// Dedup on (country_code, node_key, period).
export async function upsertCapitalFlow(input: {
  country_code: string;
  node_key: string;
  period: string;
  value_usd_m: number;
  method?: string;
  confidence_grade?: string;
  provenance?: string;
  notes?: string | null;
  citations?: CorpusCitation[];
}): Promise<{ id: string }> {
  const row = {
    country_code: input.country_code,
    node_key: input.node_key,
    period: input.period,
    value_usd_m: input.value_usd_m,
    method: input.method ?? "modelled",
    confidence_grade: input.confidence_grade ?? "C",
    provenance: input.provenance ?? "corpus-fallback",
    notes: input.notes ?? null,
    citations: (input.citations ?? []) as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  const written = assertDbRow<{ id: string }>(await supabaseAdmin
    .from("country_capital_flows")
    .upsert(row as never, { onConflict: "country_code,node_key,period" })
    .select("id")
    .single(), `upsert capital flow ${input.country_code}/${input.node_key}/${input.period}`);
  return { id: written.id as string };
}

// --- Citation record ------------------------------------------------------
// Deduped on (draft_id, url) via the unique index in migration 20260714204429_*.
// Citations are always attached to an onboarding_drafts row; call sites that
// don't have a draft should mint a lightweight "corpus-fallback" draft first.
export async function recordCitation(input: {
  draft_id: string;
  url: string;
  title?: string | null;
  domain?: string | null;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("onboarding_citations")
    .select("id")
    .eq("draft_id", input.draft_id)
    .eq("url", input.url)
    .maybeSingle();
  if (existing?.id) return;
  assertDbOk(await supabaseAdmin.from("onboarding_citations").insert({
    draft_id: input.draft_id,
    url: input.url,
    title: input.title ?? null,
    domain: input.domain ?? null,
  }), "insert onboarding citation");
}


