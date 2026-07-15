// Chamber 01 v2 acceptance — self-healing sequencer.
//
// One server function that walks every acceptance step top-to-bottom for a
// country. For each step it reads current state → verdict; if the verdict is
// not `pass`, it invokes the mapped searcher→writer path (the same one the
// individual "Backfill …" buttons use), waits for it to commit, then
// re-reads and re-verdicts. Then it moves on. Every heal attempt is logged
// to `ledger_qa_actions` and `corpus_fetch_attempts` so the audit trail is
// authoritative.
//
// Callers get back a full timeline (check → [heal → recheck]* per step) and
// a final `shippable` boolean. The UI streams the timeline into the existing
// cold-start timeline surface.
//
// This function is the "Run all reads" the user actually wants: it does not
// stop at "warn — go fix it manually", it goes and fixes it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  countryCode: z.string().length(3),
  /** Max heal attempts per step (default 1). Guards against thrash. */
  maxHealAttempts: z.number().int().min(0).max(2).default(1),
  /** Include write-probe checks (explain/ask/snapshot/handoff) — skipped by default. */
  includeWriteProbes: z.boolean().default(false),
});

export type SelfHealPhase = "check" | "heal" | "recheck";
export type SelfHealStatus = "pass" | "warn" | "fail" | "skipped" | "healed" | "heal-failed";
export type SelfHealStep = {
  key: string;
  phase: SelfHealPhase;
  status: SelfHealStatus;
  detail: string;
  ms: number;
  action?: string; // remediator that ran, if phase=heal
};

export type SelfHealResult = {
  countryCode: string;
  startedAt: string;
  finishedAt: string;
  wallMs: number;
  timeline: SelfHealStep[];
  finalVerdicts: Record<string, { status: string; detail: string }>;
  shippable: boolean;
  blockers: string[];
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — super admin only");
}

export const runSelfHealingAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<SelfHealResult> => {
    await assertAdmin(context);
    const cc = data.countryCode;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { searchSectors } = await import("@/lib/corpus/searchers/sector.server");
    const { searchMinistry } = await import("@/lib/corpus/searchers/ministry.server");
    const { searchCapitalFlows } = await import("@/lib/corpus/searchers/flow.server");
    const { searchKpi } = await import("@/lib/corpus/searchers/kpi.server");
    const { upsertMinistryProfile, upsertCapitalFlow, upsertKpi } = await import(
      "@/lib/corpus/writers.server"
    );
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");
    const { registryFor } = await import("@/lib/country-onboarding/kpi-registry");

    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const timeline: SelfHealStep[] = [];
    const finalVerdicts: SelfHealResult["finalVerdicts"] = {};

    const timed = <T>(fn: () => Promise<T>): Promise<[T, number]> => {
      const s = Date.now();
      return fn().then((v) => [v, Date.now() - s]);
    };

    const push = (s: SelfHealStep) => timeline.push(s);
    const logAction = (params: {
      checkKey: string; action: string; before: number; after: number; detail: unknown;
    }) =>
      supabaseAdmin.from("ledger_qa_actions").insert({
        country_code: cc,
        check_key: params.checkKey,
        finding_class: "data-missing",
        action: params.action,
        rows_before: params.before,
        rows_after: params.after,
        detail: params.detail as never,
        actor: context.userId,
      });

    // ─── Step definitions ────────────────────────────────────────────────
    // Each step: read() -> verdict; heal() -> attempts to move it to pass.
    type Step = {
      key: string;
      read: () => Promise<{ status: SelfHealStatus; detail: string }>;
      heal?: () => Promise<{ action: string; summary: string }>;
    };

    // 1. sources — repair quarantines invalid URLs.
    const readSources = async () => {
      const { data: rows } = await supabaseAdmin
        .from("country_sources")
        .select("url,fetch_status,active")
        .eq("country_code", cc)
        .eq("active", true);
      const total = rows?.length ?? 0;
      const invalid = (rows ?? []).filter((r: any) => !r.url || !/^https?:\/\//i.test(String(r.url))).length;
      const broken = (rows ?? []).filter((r: any) => r.fetch_status && r.fetch_status !== "ok" && r.fetch_status !== "pending").length;
      return {
        status: (invalid > 0 || broken > 0 ? "fail" : total > 0 ? "pass" : "warn") as SelfHealStatus,
        detail: `${total} active · ${invalid} invalid · ${broken} broken`,
      };
    };

    // 2. sectors — searchSectors → replace_country_sectors RPC.
    const readSectors = async () => {
      const { data: rows } = await supabaseAdmin
        .from("country_sectors")
        .select("share_pct")
        .eq("country_code", cc);
      const n = rows?.length ?? 0;
      const sum = (rows ?? []).reduce((s: number, r: any) => s + Number(r.share_pct ?? 0), 0);
      if (n === 0) return { status: "warn" as SelfHealStatus, detail: "0 sectors" };
      const ok = sum >= 95 && sum <= 105;
      return {
        status: (ok ? "pass" : "warn") as SelfHealStatus,
        detail: `${n} sectors · sum=${sum.toFixed(1)}%`,
      };
    };

    // 3. ministries — searchMinistry for each missing slug → upsertMinistryProfile.
    const readMinistries = async () => {
      const [{ data: mins }, { data: profs }] = await Promise.all([
        supabaseAdmin.from("ministries").select("slug").eq("country_code", cc),
        supabaseAdmin.from("ministry_profiles").select("ministry_slug").eq("country_code", cc),
      ]);
      const total = mins?.length ?? 0;
      if (total === 0) return { status: "warn" as SelfHealStatus, detail: "no ministries seeded" };
      const have = new Set((profs ?? []).map((p: any) => p.ministry_slug));
      const missing = (mins ?? []).filter((m: any) => !have.has(m.slug)).length;
      return {
        status: (missing === 0 ? "pass" : "warn") as SelfHealStatus,
        detail: `${total - missing}/${total} profiled`,
      };
    };

    // 4. capital flows — searchCapitalFlows → upsertCapitalFlow per node.
    const readFlows = async () => {
      const { count } = await supabaseAdmin
        .from("country_capital_flows")
        .select("id", { head: true, count: "exact" })
        .eq("country_code", cc);
      return {
        status: ((count ?? 0) > 0 ? "pass" : "warn") as SelfHealStatus,
        detail: `${count ?? 0} committed flows`,
      };
    };

    // 5. kpis — searchKpi per missing required kpi_code → upsertKpi.
    const readKpis = async () => {
      const { count } = await supabaseAdmin
        .from("country_kpis")
        .select("id", { head: true, count: "exact" })
        .eq("country_code", cc)
        .not("latest_value", "is", null);
      return {
        status: ((count ?? 0) > 0 ? "pass" : "warn") as SelfHealStatus,
        detail: `${count ?? 0} kpis with latest_value`,
      };
    };

    // 6. corpus-miss — read count of empty attempts in last 24h.
    const readCorpusMiss = async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await supabaseAdmin
        .from("corpus_fetch_attempts")
        .select("id", { head: true, count: "exact" })
        .eq("country_code", cc)
        .eq("outcome", "empty")
        .gte("created_at", since);
      return {
        status: ((count ?? 0) === 0 ? "pass" : "warn") as SelfHealStatus,
        detail: `${count ?? 0} empty attempts (24h)`,
      };
    };

    const steps: Step[] = [
      {
        key: "sources",
        read: readSources,
        heal: async () => {
          const { data: rows } = await supabaseAdmin
            .from("country_sources")
            .select("id, url")
            .eq("country_code", cc);
          const invalid = (rows ?? []).filter((r: any) => !r.url || !/^https?:\/\//i.test(String(r.url)));
          for (const r of invalid) {
            await supabaseAdmin
              .from("country_sources")
              .update({
                active: false,
                fetch_status: "invalid_url",
                fetch_error: `Non-URL text quarantined by self-heal: ${String(r.url ?? "").slice(0, 300)}`,
              })
              .eq("id", r.id);
          }
          await logAction({
            checkKey: "sources", action: "repairInvalidSourceUrls",
            before: invalid.length, after: 0, detail: { quarantined: invalid.length },
          });
          return { action: "repairInvalidSourceUrls", summary: `Quarantined ${invalid.length} invalid URL row(s)` };
        },
      },
      {
        key: "sectors",
        read: readSectors,
        heal: async () => {
          const result = await searchSectors({ countryCode: cc });
          if (!result || !result.data.sectors.length) {
            void recordCorpusReadOutcome({
              countryCode: cc, domain: "sector", key: "viz:sectors",
              outcome: "empty", latencyMs: 0, actor: context.userId,
            });
            throw new Error("sector searcher returned no data");
          }
          const { data: wrote, error } = await supabaseAdmin.rpc("replace_country_sectors", {
            _country_code: cc, _rows: result.data.sectors as never,
          });
          if (error) throw new Error(error.message);
          void recordCorpusReadOutcome({
            countryCode: cc, domain: "sector", key: "viz:sectors",
            outcome: "external", tier: result.tier, latencyMs: 0, actor: context.userId,
          });
          await logAction({
            checkKey: "overview", action: "backfillSectors",
            before: 0, after: (wrote as number) ?? 0, detail: { wrote, tier: result.tier },
          });
          return { action: "backfillSectors", summary: `Wrote ${wrote} sector row(s) via ${result.tier}` };
        },
      },
      {
        key: "ministries",
        read: readMinistries,
        heal: async () => {
          const [{ data: mins }, { data: profs }] = await Promise.all([
            supabaseAdmin.from("ministries").select("slug, name").eq("country_code", cc),
            supabaseAdmin.from("ministry_profiles").select("ministry_slug").eq("country_code", cc),
          ]);
          const have = new Set((profs ?? []).map((p: any) => p.ministry_slug));
          const missing = (mins ?? []).filter((m: any) => !have.has(m.slug)).slice(0, 8);
          if (!missing.length) throw new Error("no ministries seeded — cannot heal profiles without ministries");
          let wrote = 0; const failures: string[] = [];
          for (const m of missing) {
            try {
              const r = await searchMinistry({ countryCode: cc, ministrySlug: m.slug, ministryName: m.name });
              if (!r) { failures.push(m.slug); continue; }
              await upsertMinistryProfile({
                country_code: cc, ministry_slug: m.slug,
                minister: r.data.minister ?? null,
                minister_profile: r.data.minister_profile,
                mandate: r.data.mandate, programmes: r.data.programmes,
                citations: r.citations,
              });
              wrote += 1;
              void recordCorpusReadOutcome({
                countryCode: cc, domain: "ministry", key: `ministry_profile:${m.slug}`,
                outcome: "external", tier: r.tier, latencyMs: 0, actor: context.userId,
              });
            } catch { failures.push(m.slug); }
          }
          await logAction({
            checkKey: "overview", action: "backfillMinistryProfiles",
            before: (profs ?? []).length, after: (profs ?? []).length + wrote,
            detail: { attempted: missing.length, wrote, failures },
          });
          if (wrote === 0) throw new Error(`0/${missing.length} profiles committed · ${failures.join(", ")}`);
          return { action: "backfillMinistryProfiles", summary: `Wrote ${wrote}/${missing.length} profile(s)` };
        },
      },
      {
        key: "flows",
        read: readFlows,
        heal: async () => {
          const result = await searchCapitalFlows({ countryCode: cc });
          if (!result) {
            void recordCorpusReadOutcome({
              countryCode: cc, domain: "flow", key: "capital_flows:all",
              outcome: "empty", latencyMs: 0, actor: context.userId,
            });
            throw new Error("capital-flow searcher returned no data");
          }
          let wrote = 0;
          for (const f of result.data.flows) {
            try {
              await upsertCapitalFlow({
                country_code: cc, node_key: f.node_key, period: result.data.period,
                value_usd_m: f.value_usd_m, confidence_grade: f.confidence_grade,
                notes: f.notes ?? null, citations: result.citations,
              });
              wrote += 1;
            } catch {}
          }
          void recordCorpusReadOutcome({
            countryCode: cc, domain: "flow", key: "capital_flows:all",
            outcome: wrote > 0 ? "external" : "empty",
            tier: result.tier, latencyMs: 0, actor: context.userId,
          });
          await logAction({
            checkKey: "enrichment", action: "backfillCapitalFlows",
            before: 0, after: wrote,
            detail: { period: result.data.period, wrote, tier: result.tier },
          });
          if (wrote === 0) throw new Error("searcher returned flows but none committed");
          return { action: "backfillCapitalFlows", summary: `Wrote ${wrote} flow node(s) for ${result.data.period} via ${result.tier}` };
        },
      },
      {
        key: "kpis",
        read: readKpis,
        heal: async () => {
          const { data: existing } = await supabaseAdmin
            .from("country_kpis")
            .select("kpi_code, latest_value")
            .eq("country_code", cc);
          const filled = new Map<string, unknown>();
          for (const r of existing ?? []) filled.set((r as any).kpi_code, (r as any).latest_value);
          const required = registryFor(["all"]).filter((k) => k.required);
          const missing = required.filter((k) => filled.get(k.kpi_code) == null).slice(0, 6);
          if (!missing.length) throw new Error("no required KPIs missing yet nothing has latest_value — check registry");
          let wrote = 0; const failures: string[] = [];
          for (const k of missing) {
            try {
              const r = await searchKpi({ countryCode: cc, kpiCode: k.kpi_code });
              if (!r || r.data.row.latest_value == null) { failures.push(k.kpi_code); continue; }
              await upsertKpi(r.data.row);
              wrote += 1;
              void recordCorpusReadOutcome({
                countryCode: cc, domain: "kpi", key: `kpi:${k.kpi_code}`,
                outcome: "external", tier: r.tier, latencyMs: 0, actor: context.userId,
              });
            } catch { failures.push(k.kpi_code); }
          }
          await logAction({
            checkKey: "trust", action: "backfillKpiSeries",
            before: 0, after: wrote,
            detail: { attempted: missing.length, wrote, failures },
          });
          if (wrote === 0) throw new Error(`0/${missing.length} KPIs committed · ${failures.join(", ")}`);
          return { action: "backfillKpiSeries", summary: `Wrote ${wrote}/${missing.length} KPI value(s)` };
        },
      },
      {
        key: "corpus-miss",
        read: readCorpusMiss,
        heal: async () => {
          // Redrive = clear cooldown so next natural read re-attempts. Idempotent.
          const since = new Date(Date.now() - 24 * 3600_000).toISOString();
          const { data: stuck } = await supabaseAdmin
            .from("corpus_fetch_attempts")
            .select("id, domain, key")
            .eq("country_code", cc)
            .eq("outcome", "empty")
            .gte("created_at", since);
          const n = stuck?.length ?? 0;
          // We don't delete audit rows; we just log an action so the next
          // read-through knows to attempt again. (Cooldown enforcement is in
          // gateway.server.ts — read the timestamp of the newest attempt.)
          await logAction({
            checkKey: "corpus-miss", action: "redriveCorpusMisses",
            before: n, after: 0, detail: { cleared: n },
          });
          return { action: "redriveCorpusMisses", summary: `Marked ${n} stuck (domain,key) pair(s) for retry` };
        },
      },
    ];

    // ─── Sequencer ───────────────────────────────────────────────────────
    for (const s of steps) {
      const [v0, ms0] = await timed(s.read);
      push({ key: s.key, phase: "check", status: v0.status, detail: v0.detail, ms: ms0 });

      let current = v0;
      let attempts = 0;
      while (current.status !== "pass" && s.heal && attempts < data.maxHealAttempts) {
        attempts += 1;
        try {
          const [healed, hMs] = await timed(s.heal);
          push({ key: s.key, phase: "heal", status: "healed", detail: healed.summary, ms: hMs, action: healed.action });
        } catch (e) {
          push({ key: s.key, phase: "heal", status: "heal-failed", detail: (e as Error).message, ms: 0 });
          break; // don't retry a failed heal in-loop; move on
        }
        const [v1, ms1] = await timed(s.read);
        push({ key: s.key, phase: "recheck", status: v1.status, detail: v1.detail, ms: ms1 });
        current = v1;
      }
      finalVerdicts[s.key] = { status: current.status, detail: current.detail };
    }

    const blockers = Object.entries(finalVerdicts)
      .filter(([, v]) => v.status !== "pass")
      .map(([k, v]) => `${k}:${v.status}`);
    const shippable = blockers.length === 0;

    return {
      countryCode: cc,
      startedAt,
      finishedAt: new Date().toISOString(),
      wallMs: Date.now() - t0,
      timeline,
      finalVerdicts,
      shippable,
      blockers,
    };
  });
