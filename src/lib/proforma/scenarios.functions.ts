// @domain agency
// @tables countries, proforma_scenarios
// @ui src/routes/_authenticated/admin/proforma.tsx
//
// Agency pro forma persistence + market read. Global admins only — the caller's
// role is verified through the authenticated client before any privileged work.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CARIBBEAN_FALLBACK, type MarketCountry } from "./model";

const assumptionsSchema = z.record(z.string(), z.unknown());

async function assertGlobalAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

/**
 * The sellable Caribbean market, taken from the corpus where GDP has been
 * committed and topped up from the fallback table where it has not.
 */
export const listMarketCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MarketCountry[]> => {
    await assertGlobalAdmin(context as never);

    const { data, error } = await context.supabase
      .from("countries")
      .select("code, name, gdp_current_usd, is_caricom, is_oecs")
      .order("gdp_current_usd", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    const byCode = new Map(CARIBBEAN_FALLBACK.map((c) => [c.code.toUpperCase(), c]));
    const out: MarketCountry[] = [];

    for (const row of data ?? []) {
      const code = String(row.code).toUpperCase();
      const seed = byCode.get(code);
      const gdp = Number(row.gdp_current_usd ?? 0) || seed?.gdpUsd || 0;
      if (gdp <= 0) continue;
      out.push({
        code,
        name: row.name ?? seed?.name ?? code,
        gdpUsd: gdp,
        publicSpendPct: seed?.publicSpendPct ?? 27,
        topSectorSharePct: seed?.topSectorSharePct ?? 42,
      });
      byCode.delete(code);
    }

    for (const seed of byCode.values()) out.push(seed);

    return out.sort((a, b) => b.gdpUsd - a.gdpUsd);
  });

export const listProformaScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGlobalAdmin(context as never);
    const { data, error } = await context.supabase
      .from("proforma_scenarios")
      .select("id, name, notes, assumptions, model_version, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveProformaScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(160),
        notes: z.string().max(2000).optional(),
        assumptions: assumptionsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context as never);

    if (data.id) {
      const { error } = await context.supabase
        .from("proforma_scenarios")
        .update({ name: data.name, notes: data.notes ?? null, assumptions: data.assumptions })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("proforma_scenarios")
      .insert({
        name: data.name,
        notes: data.notes ?? null,
        assumptions: data.assumptions,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteProformaScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context as never);
    const { error } = await context.supabase
      .from("proforma_scenarios")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
