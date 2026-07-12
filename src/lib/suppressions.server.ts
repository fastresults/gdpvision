// Central source-suppression helper (PRD Wave B4).
// Given a scope and optional user/sectors, returns the set of memory_object
// source_ids that are currently suppressed for that scope. Every retrieval
// path that pulls from Second Brain (Counsel, CitationsRail, dossier, etc.)
// should filter through this helper.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function applySourceSuppressions(
  supabase: { from: (t: string) => any },
  scopeKey: string,
  _userId?: string,
  _sectorCodes?: string[],
): Promise<Set<string>> {
  const { data: rows } = await supabase
    .from("source_suppressions")
    .select("source_id")
    .eq("scope_key", scopeKey)
    .eq("active", true);
  return new Set((rows ?? []).map((s: { source_id: string }) => s.source_id));
}

const Input = z.object({ scopeKey: z.string().min(3).max(16) });

export const listSuppressedSourceIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const set = await applySourceSuppressions(context.supabase, data.scopeKey);
    return [...set];
  });
