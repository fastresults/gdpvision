// @domain indices
// @tables user_roles
// @ui none
//
// Role checks shared by every Caribbean Indices server function. Admins can do
// everything; data stewards can read runs and enter or verify evidence.
//
// The indices are regional (every state in one run), so only GLOBAL roles count:
// a user_roles row with country_code IS NULL. `has_role()` ignores country_code,
// which would let a steward (or admin) scoped to one country read every state's
// private trackers and draft scores, verify any state's evidence, or publish.

import type { db } from "@/lib/syndication/db";

export type IndicesCtx = { supabase: Parameters<typeof db>[0]; userId: string };
export type IndicesRole = "admin" | "data_steward";

/** The caller's global indices roles. */
export async function globalIndicesRoles(ctx: IndicesCtx): Promise<Set<IndicesRole>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .is("country_code", null)
    .in("role", ["admin", "data_steward"]);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Array<{ role: string }>).map((r) => r.role as IndicesRole));
}

export async function hasIndicesRole(ctx: IndicesCtx, role: IndicesRole): Promise<boolean> {
  return (await globalIndicesRoles(ctx)).has(role);
}

/** Throws "Forbidden" unless the caller holds `role` globally (admins pass every steward check). */
export async function assertIndicesRole(ctx: IndicesCtx, role: IndicesRole = "admin") {
  const roles = await globalIndicesRoles(ctx);
  if (roles.has(role) || (role === "data_steward" && roles.has("admin"))) return;
  throw new Error("Forbidden");
}
