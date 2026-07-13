// Sequential onboarding orchestrator.
//
// One country = one run at a time. Each stage runs inline through the existing
// per-stage runner + committer (called from the admin UI). No worker pool, no
// cron, no durable job tables. The single helper below tells the UI which
// stage to run next based on the committed-rows source of truth.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Stage =
  | "profile"
  | "gdp"
  | "sector_composition"
  | "ministries"
  | "ministry_sector_map"
  | "source_registry"
  | "kpi_seed"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed"
  | "capital_flows";

// Fixed sequential order — later stages depend on data written by earlier ones.
export const STAGE_ORDER: Stage[] = [
  "profile",
  "gdp",
  "sector_composition",
  "ministries",
  "ministry_sector_map",
  "source_registry",
  "kpi_seed",
  "sector_dossier",
  "ministry_deep_dive",
  "corpus_ingest",
  "second_brain_seed",
  "capital_flows",
];

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  rerun: z.boolean().optional().default(false),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

async function committedRowsByStage(
  admin: any,
  countryCode: string,
): Promise<Record<Stage, number>> {
  const count = async (q: any) => {
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };
  const [
    countryRow,
    sectors,
    ministries,
    ministrySectors,
    sources,
    kpis,
    dossiers,
    ministryProfiles,
    chunks,
    memories,
    flows,
  ] = await Promise.all([
    admin.from("countries").select("profile_committed_at, gdp_committed_at").eq("code", countryCode).maybeSingle(),
    count(admin.from("country_sectors").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("ministries").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("ministry_sectors").select("ministry_id, ministries!inner(country_code)", { count: "exact", head: true }).eq("ministries.country_code", countryCode)),
    count(admin.from("country_sources").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("country_kpis").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("sector_dossiers").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("ministry_profiles").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("country_source_chunks").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("memory_objects").select("*", { count: "exact", head: true }).eq("scope_key", countryCode)),
    count(admin.from("country_capital_flows").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
  ]);
  const c = countryRow.data as { profile_committed_at?: string | null; gdp_committed_at?: string | null } | null;
  return {
    profile: c?.profile_committed_at ? 1 : 0,
    gdp: c?.gdp_committed_at ? 1 : 0,
    sector_composition: sectors,
    ministries,
    ministry_sector_map: ministrySectors,
    source_registry: sources,
    kpi_seed: kpis,
    sector_dossier: dossiers,
    ministry_deep_dive: ministryProfiles,
    corpus_ingest: chunks,
    second_brain_seed: memories,
    capital_flows: flows,
  };
}

/**
 * Returns the next stage the admin UI should run for this country.
 * - In default mode: the first stage in `STAGE_ORDER` whose target table has zero rows.
 * - In rerun mode: always returns the first stage in `STAGE_ORDER`.
 *
 * The client-side "Run all pending" loop calls this, invokes that stage's
 * runner + committer, then calls this again — until `done: true`.
 */
export const getNextOnboardingStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear any stale open onboarding_runs row for this country (>15min without heartbeat)
    // so a new run for the same stage isn't blocked by the unique index.
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("onboarding_runs")
      .update({ status: "stale", finished_at: new Date().toISOString(), error: "auto-cleared: no heartbeat >15min" })
      .eq("country_code", data.countryCode)
      .in("status", ["queued", "planning", "searching", "extracting", "validating"])
      .lt("updated_at", cutoff);

    const committed = await committedRowsByStage(supabaseAdmin, data.countryCode);

    let nextStage: Stage | null = null;
    if (data.rerun) {
      nextStage = STAGE_ORDER[0];
    } else {
      for (const stage of STAGE_ORDER) {
        if ((committed[stage] ?? 0) === 0) {
          nextStage = stage;
          break;
        }
      }
    }

    const remaining = STAGE_ORDER.filter((s) => (committed[s] ?? 0) === 0).length;
    return {
      nextStage,
      done: nextStage === null,
      remaining,
      committed,
    };
  });

/**
 * Manually clear stale open onboarding_runs rows for a country. Used by the
 * "Clear locks" button if a previous run got interrupted mid-flight and the
 * unique index is blocking a retry sooner than the auto-clear window.
 */
export const clearOnboardingLocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string().min(2).max(4) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cleared, error } = await supabaseAdmin
      .from("onboarding_runs")
      .update({ status: "stale", finished_at: new Date().toISOString(), error: "manually cleared" })
      .eq("country_code", data.countryCode)
      .in("status", ["queued", "planning", "searching", "extracting", "validating"])
      .select("id, stage");
    if (error) throw error;
    return { cleared: cleared?.length ?? 0, stages: (cleared ?? []).map((r: any) => r.stage) };
  });
