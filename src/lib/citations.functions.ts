// Persistent citation bindings (PRD Wave B2).
// Links artifact blocks (strategy, comms, counsel) to Second-Brain memory objects
// with optional quote + position metadata. Stored in the `citations` table.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applySourceSuppressions } from "@/lib/suppressions.server";

export interface CitationBinding {
  id: string;
  ownerType: string;
  ownerId: string;
  memoryObjectId: string;
  label: string;
  kind: string;
  quote?: string;
  bucket?: string;
  positionOffset: number;
  scopeKey: string;
  sectorCode?: string;
  createdBy: string;
  createdAt: string;
}

export interface CitationCandidate {
  ref: string;
  label: string;
  kind: string;
  sectorCode: string;
  weight: number;
  verified: boolean;
}

const ListInput = z.object({
  ownerType: z.enum(["strategy", "comms", "counsel"]),
  ownerId: z.string().uuid(),
});

export const getCitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }): Promise<CitationBinding[]> => {
    const { data: rows, error } = await context.supabase
      .from("citations")
      .select("id,owner_type,owner_id,memory_object_id,quote,bucket,position_offset,scope_key,sector_code,created_by,created_at,memory_objects:memory_object_id(kind,title,weight,verified)")
      .eq("owner_type", data.ownerType)
      .eq("owner_id", data.ownerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      ownerType: r.owner_type,
      ownerId: r.owner_id,
      memoryObjectId: r.memory_object_id,
      label: r.memory_objects?.title ?? "(unknown)",
      kind: r.memory_objects?.kind ?? "memory",
      quote: r.quote ?? undefined,
      bucket: r.bucket ?? undefined,
      positionOffset: r.position_offset ?? 0,
      scopeKey: r.scope_key,
      sectorCode: r.sector_code ?? undefined,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  });

const SaveInput = z.object({
  ownerType: z.enum(["strategy", "comms", "counsel"]),
  ownerId: z.string().uuid(),
  scopeKey: z.string().min(3).max(16),
  sectorCode: z.string().min(2).max(64).optional(),
  sources: z.array(
    z.object({
      ref: z.string().min(1),
      label: z.string().min(1),
      quote: z.string().max(500).optional(),
      bucket: z.string().max(64).optional(),
      positionOffset: z.number().int().default(0),
    }),
  ),
});

export const saveCitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    // Resolve memory_object IDs from refs like "memory:<id>".
    const refs = data.sources.map((s) => {
      const id = s.ref.replace(/^memory:/, "");
      return { id, source: s };
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Delete existing bindings for this artifact, then insert the new set.
    const { error: delErr } = await supabaseAdmin
      .from("citations")
      .delete()
      .eq("owner_type", data.ownerType)
      .eq("owner_id", data.ownerId);
    if (delErr) throw new Error(delErr.message);

    if (refs.length > 0) {
      const rows = refs.map((r) => ({
        owner_type: data.ownerType,
        owner_id: data.ownerId,
        memory_object_id: r.id,
        quote: r.source.quote ?? null,
        bucket: r.source.bucket ?? null,
        position_offset: r.source.positionOffset,
        scope_key: data.scopeKey,
        sector_code: data.sectorCode ?? null,
        created_by: context.userId,
      }));
      const { error: insErr } = await supabaseAdmin.from("citations").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true };
  });

const CandidatesInput = z.object({
  scopeKey: z.string().min(3).max(16),
  sectorCode: z.string().min(2).max(64).optional(),
  limit: z.number().int().min(1).max(50).default(15),
});

export const listCitationCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandidatesInput.parse(d))
  .handler(async ({ data, context }): Promise<CitationCandidate[]> => {
    const suppressedIds = await applySourceSuppressions(
      context.supabase,
      data.scopeKey,
      context.userId,
      data.sectorCode ? [data.sectorCode] : undefined,
    );

    let q = context.supabase
      .from("memory_objects")
      .select("id,title,kind,sector_code,weight,verified,source_id")
      .eq("scope_key", data.scopeKey)
      .order("weight", { ascending: false, nullsFirst: false })
      .limit(data.limit * 2);
    if (data.sectorCode) q = q.eq("sector_code", data.sectorCode);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return (rows ?? [])
      .filter((r) => !r.source_id || !suppressedIds.has(r.source_id))
      .slice(0, data.limit)
      .map((r) => ({
        ref: `memory:${r.id}`,
        label: r.title,
        kind: r.kind as string,
        sectorCode: r.sector_code,
        weight: r.weight ?? 3,
        verified: !!r.verified,
      }));
  });
