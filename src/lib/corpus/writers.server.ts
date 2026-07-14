// Centralized, idempotent write-back for every corpus domain.
// The gateway's writeBack callbacks should call these; new code should not
// re-inline table upserts.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertCountrySource as upsertCountrySourceImpl } from "@/lib/country-data/sources.server";
import type { CorpusCitation } from "./types";

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
  ministry_slug?: string | null;
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

  if (existing?.id) {
    await supabaseAdmin
      .from("memory_objects")
      .update({
        weight: Math.max(Number(existing.weight ?? 0), input.weight ?? 1),
        payload: input.payload ?? existing.payload,
        sector_code: input.sector_code ?? null,
        source_id: input.source_id ?? null,
        ministry_slug: input.ministry_slug ?? null,
      })
      .eq("id", existing.id);
    return { id: existing.id as string, existed: true };
  }

  const { data: created, error } = await supabaseAdmin
    .from("memory_objects")
    .insert({
      scope_key: input.scope_key,
      kind: input.kind,
      title: input.title,
      payload: input.payload ?? {},
      weight: input.weight ?? 1,
      sector_code: input.sector_code ?? null,
      source_id: input.source_id ?? null,
      ministry_slug: input.ministry_slug ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return null;
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

// --- Data revision breadcrumb --------------------------------------------
export async function recordFallbackRevision(params: {
  country_code: string;
  entity: string;
  entity_id?: string | null;
  tier: string;
  citations: CorpusCitation[];
}) {
  try {
    await supabaseAdmin.from("data_revisions").insert({
      country_code: params.country_code,
      entity: params.entity,
      entity_id: params.entity_id ?? null,
      source: "external-fallback",
      notes: { tier: params.tier, citations: params.citations },
    });
  } catch {
    // Non-fatal.
  }
}
