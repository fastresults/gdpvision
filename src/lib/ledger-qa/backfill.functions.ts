// Ledger-QA self-heal backfill server functions.
// Every function is admin-gated, idempotent, budgeted, and posts to
// ledger_qa_actions so the audit trail is authoritative.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CountryInput = z.object({ countryCode: z.string().length(3) });
const DomainAttemptsInput = z.object({
  countryCode: z.string().length(3),
  domain: z.string().min(2).max(32).optional(),
  limit: z.number().int().min(1).max(50).default(5),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — super admin only");
}

async function logAction(params: {
  supabaseAdmin: any;
  countryCode: string;
  checkKey: string;
  action: string;
  before: number;
  after: number;
  detail: unknown;
  actor: string;
}) {
  await params.supabaseAdmin.from("ledger_qa_actions").insert({
    country_code: params.countryCode,
    check_key: params.checkKey,
    finding_class: "data-missing",
    action: params.action,
    rows_before: params.before,
    rows_after: params.after,
    detail: params.detail as never,
    actor: params.actor,
  });
}

// ─── 1. Capital flows ────────────────────────────────────────────────────────
export const backfillCapitalFlows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const cc = data.countryCode;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { searchCapitalFlows } = await import("@/lib/corpus/searchers/flow.server");
    const { upsertCapitalFlow } = await import("@/lib/corpus/writers.server");
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");

    const t0 = Date.now();
    const { count: before } = await supabaseAdmin
      .from("country_capital_flows")
      .select("id", { head: true, count: "exact" })
      .eq("country_code", cc);

    const result = await searchCapitalFlows({ countryCode: cc });
    if (!result) {
      void recordCorpusReadOutcome({
        countryCode: cc, domain: "flow", key: "capital_flows:all",
        outcome: "empty", latencyMs: Date.now() - t0, actor: context.userId,
      });
      await logAction({
        supabaseAdmin, countryCode: cc, checkKey: "enrichment",
        action: "backfillCapitalFlows", before: before ?? 0, after: before ?? 0,
        detail: { note: "searcher returned no data" }, actor: context.userId,
      });
      return { wrote: 0, period: null, before: before ?? 0, summary: "External search returned no data" };
    }

    let wrote = 0;
    for (const f of result.data.flows) {
      try {
        await upsertCapitalFlow({
          country_code: cc,
          node_key: f.node_key,
          period: result.data.period,
          value_usd_m: f.value_usd_m,
          confidence_grade: f.confidence_grade,
          notes: f.notes ?? null,
          citations: result.citations,
        });
        wrote += 1;
      } catch {
        // continue on individual failures
      }
    }

    const { count: after } = await supabaseAdmin
      .from("country_capital_flows")
      .select("id", { head: true, count: "exact" })
      .eq("country_code", cc);

    void recordCorpusReadOutcome({
      countryCode: cc, domain: "flow", key: "capital_flows:all",
      outcome: wrote > 0 ? "external" : "empty",
      tier: result.tier, latencyMs: Date.now() - t0, actor: context.userId,
    });
    await logAction({
      supabaseAdmin, countryCode: cc, checkKey: "enrichment",
      action: "backfillCapitalFlows", before: before ?? 0, after: after ?? 0,
      detail: { period: result.data.period, wrote, tier: result.tier }, actor: context.userId,
    });

    return { wrote, period: result.data.period, before: before ?? 0, summary: `Wrote ${wrote} flow node(s) for ${result.data.period} via ${result.tier}` };
  });

// ─── 2. Sectors ──────────────────────────────────────────────────────────────
export const backfillSectors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const cc = data.countryCode;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { searchSectors } = await import("@/lib/corpus/searchers/sector.server");
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");

    const t0 = Date.now();
    const { count: before } = await supabaseAdmin
      .from("country_sectors")
      .select("id", { head: true, count: "exact" })
      .eq("country_code", cc);

    const result = await searchSectors({ countryCode: cc });
    if (!result || !result.data.sectors.length) {
      void recordCorpusReadOutcome({
        countryCode: cc, domain: "sector", key: "viz:sectors",
        outcome: "empty", latencyMs: Date.now() - t0, actor: context.userId,
      });
      await logAction({
        supabaseAdmin, countryCode: cc, checkKey: "overview",
        action: "backfillSectors", before: before ?? 0, after: before ?? 0,
        detail: { note: "searcher returned no data" }, actor: context.userId,
      });
      return { wrote: 0, before: before ?? 0, summary: "External search returned no sectors" };
    }

    const { data: wrote, error } = await supabaseAdmin.rpc("replace_country_sectors", {
      _country_code: cc,
      _rows: result.data.sectors as never,
    });
    if (error) throw new Error(error.message);

    void recordCorpusReadOutcome({
      countryCode: cc, domain: "sector", key: "viz:sectors",
      outcome: "external", tier: result.tier,
      latencyMs: Date.now() - t0, actor: context.userId,
    });
    await logAction({
      supabaseAdmin, countryCode: cc, checkKey: "overview",
      action: "backfillSectors", before: before ?? 0, after: (wrote as number) ?? 0,
      detail: { wrote, tier: result.tier }, actor: context.userId,
    });

    return { wrote: (wrote as number) ?? 0, before: before ?? 0, summary: `Wrote ${wrote} sector row(s) via ${result.tier}` };
  });

// ─── 3. Ministry profiles ────────────────────────────────────────────────────
export const backfillMinistryProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const cc = data.countryCode;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { searchMinistry } = await import("@/lib/corpus/searchers/ministry.server");
    const { upsertMinistryProfile } = await import("@/lib/corpus/writers.server");
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");

    const t0 = Date.now();
    const [{ data: ministries }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("ministries").select("slug, name").eq("country_code", cc),
      supabaseAdmin.from("ministry_profiles").select("ministry_slug").eq("country_code", cc),
    ]);

    const before = (profiles ?? []).length;
    const have = new Set((profiles ?? []).map((p: any) => p.ministry_slug));
    const missing = (ministries ?? []).filter((m: any) => !have.has(m.slug));
    if (!missing.length) {
      return { wrote: 0, before, missing: 0, summary: `All ${before} ministries already have profiles` };
    }

    // Cap to first 8 to keep within the 30s budget.
    const targets = missing.slice(0, 8);
    let wrote = 0;
    const failures: string[] = [];
    for (const m of targets) {
      try {
        const result = await searchMinistry({ countryCode: cc, ministrySlug: m.slug, ministryName: m.name });
        if (!result) { failures.push(m.slug); continue; }
        await upsertMinistryProfile({
          country_code: cc,
          ministry_slug: m.slug,
          minister: result.data.minister ?? null,
          minister_profile: result.data.minister_profile,
          mandate: result.data.mandate,
          programmes: result.data.programmes,
          citations: result.citations,
        });
        wrote += 1;
        void recordCorpusReadOutcome({
          countryCode: cc, domain: "ministry", key: `ministry_profile:${m.slug}`,
          outcome: "external", tier: result.tier, latencyMs: 0, actor: context.userId,
        });
      } catch (e) {
        failures.push(m.slug);
      }
    }

    await logAction({
      supabaseAdmin, countryCode: cc, checkKey: "overview",
      action: "backfillMinistryProfiles",
      before, after: before + wrote,
      detail: { attempted: targets.length, wrote, failures, remaining_missing: missing.length - targets.length },
      actor: context.userId,
    });

    const remaining = missing.length - targets.length;
    return {
      wrote, before, missing: missing.length,
      summary: `Wrote ${wrote}/${targets.length} profile(s)${remaining > 0 ? `, ${remaining} still queued` : ""}${failures.length ? ` · failed: ${failures.join(", ")}` : ""}`,
      latencyMs: Date.now() - t0,
    };
  });

// ─── 4. KPI series ───────────────────────────────────────────────────────────
export const backfillKpiSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const cc = data.countryCode;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { searchKpi } = await import("@/lib/corpus/searchers/kpi.server");
    const { upsertKpi } = await import("@/lib/corpus/writers.server");
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");
    const { registryFor } = await import("@/lib/country-onboarding/kpi-registry");

    const t0 = Date.now();
    const { data: existing } = await supabaseAdmin
      .from("country_kpis")
      .select("kpi_code, latest_value")
      .eq("country_code", cc);
    const filled = new Map<string, unknown>();
    for (const r of existing ?? []) filled.set(r.kpi_code, r.latest_value);
    const before = Array.from(filled.values()).filter((v) => v != null).length;

    const required = registryFor(["all"]).filter((k) => k.required);
    const missing = required.filter((k) => filled.get(k.kpi_code) == null).slice(0, 6);
    if (!missing.length) {
      return { wrote: 0, before, missing: 0, summary: `All ${required.length} required KPIs have values` };
    }

    let wrote = 0;
    const failures: string[] = [];
    for (const k of missing) {
      try {
        const result = await searchKpi({ countryCode: cc, kpiCode: k.kpi_code });
        if (!result || result.data.row.latest_value == null) { failures.push(k.kpi_code); continue; }
        await upsertKpi(result.data.row);
        wrote += 1;
        void recordCorpusReadOutcome({
          countryCode: cc, domain: "kpi", key: `kpi:${k.kpi_code}`,
          outcome: "external", tier: result.tier, latencyMs: 0, actor: context.userId,
        });
      } catch {
        failures.push(k.kpi_code);
      }
    }

    await logAction({
      supabaseAdmin, countryCode: cc, checkKey: "trust",
      action: "backfillKpiSeries",
      before, after: before + wrote,
      detail: { attempted: missing.length, wrote, failures, total_required: required.length },
      actor: context.userId,
    });

    return {
      wrote, before, missing: missing.length,
      summary: `Wrote ${wrote}/${missing.length} KPI value(s)${failures.length ? ` · failed: ${failures.join(", ")}` : ""}`,
      latencyMs: Date.now() - t0,
    };
  });

// ─── 5. Recent corpus attempts (Phase 5 visibility) ──────────────────────────
export const getRecentCorpusAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DomainAttemptsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("corpus_fetch_attempts")
      .select("id, domain, key, outcome, tier, latency_ms, actor, notes, created_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.domain) q = q.eq("domain", data.domain);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
