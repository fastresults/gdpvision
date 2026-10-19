// @domain indices
// @tables none
// @ui none
//
// Role checks shared by every Caribbean Indices server function. Admins can do
// everything; data stewards can read runs and enter or verify evidence.

import { db } from "@/lib/syndication/db";

export type IndicesCtx = { supabase: Parameters<typeof db>[0]; userId: string };

export async function hasIndicesRole(
  ctx: IndicesCtx,
  role: "admin" | "data_steward",
): Promise<boolean> {
  const { data } = await db(ctx.supabase).rpc("has_role", { _user_id: ctx.userId, _role: role });
  return Boolean(data);
}

/** Throws "Forbidden" unless the caller holds `role` (admins pass every steward check). */
export async function assertIndicesRole(ctx: IndicesCtx, role: "admin" | "data_steward" = "admin") {
  if (await hasIndicesRole(ctx, role)) return;
  if (role === "data_steward" && (await hasIndicesRole(ctx, "admin"))) return;
  throw new Error("Forbidden");
}
