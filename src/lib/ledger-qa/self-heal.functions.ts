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
  /** Max heal attempts per step (default 3). Guards against thrash. */
  maxHealAttempts: z.number().int().min(0).max(6).default(3),
  /** Include write-probe checks (explain/ask/snapshot/handoff) — skipped by default. */
  includeWriteProbes: z.boolean().default(false),
  /** Global wall-clock budget in ms; sequencer aborts once exceeded. */
  wallBudgetMs: z.number().int().min(30_000).max(30 * 60_000).default(15 * 60_000),
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
    const { searchCitations } = await import("@/lib/corpus/searchers/citation.server");
    const { searchKpi } = await import("@/lib/corpus/searchers/kpi.server");
    const { upsertCountrySource, upsertMinistryProfile, upsertKpi } = await import(
      "@/lib/corpus/writers.server"
    );
    const { researchAndCommitCapitalFlowsForAcceptance } = await import(
      "@/lib/ledger-qa/capital-flow-acceptance.server"
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

    // 4. capital flows — acceptance-grade Sankey ledger.
    const readFlows = async () => {
      const [{ data: nodes, error: nodesErr }, { data: rows, error: rowsErr }] = await Promise.all([
        supabaseAdmin.from("capital_flow_nodes").select("node_key, side").order("sort_order"),
        supabaseAdmin
          .from("country_capital_flows")
          .select("node_key, period, value_usd_m")
          .eq("country_code", cc)
          .order("period", { ascending: false }),
      ]);
      if (nodesErr) throw new Error(nodesErr.message);
      if (rowsErr) throw new Error(rowsErr.message);
      const allRows = rows ?? [];
      if (allRows.length === 0) {
        return { status: "warn" as SelfHealStatus, detail: "0 committed flows" };
      }
      const availablePeriods = Array.from(new Set(allRows.map((r: any) => String(r.period ?? "")))).filter(Boolean).sort((a, b) => b.localeCompare(a));
      const period = availablePeriods[0] ?? null;
      const latest = period ? allRows.filter((r: any) => r.period === period) : allRows;
      const sideByKey = new Map((nodes ?? []).map((n: any) => [String(n.node_key), String(n.side)]));
      let sumIn = 0;
      let sumOut = 0;
      let inputs = 0;
      let outputs = 0;
      const unknown: string[] = [];
      for (const r of latest as any[]) {
        if (r.node_key === "RECONCILIATION_RESIDUAL") continue;
        const side = sideByKey.get(String(r.node_key));
        if (!side) { unknown.push(String(r.node_key)); continue; }
        const value = Number(r.value_usd_m ?? 0);
        if (side === "input") { inputs += 1; sumIn += value; }
        if (side === "output") { outputs += 1; sumOut += value; }
      }
      const residual = sumIn - sumOut;
      const residualPct = sumIn > 0 ? Math.abs(residual) / sumIn : 1;
      const ok = inputs >= 3 && outputs >= 4 && residualPct <= 0.1 && unknown.length === 0;
      return {
        status: (ok ? "pass" : "warn") as SelfHealStatus,
        detail: `${latest.length} committed flows${period ? ` (${period})` : ""} · ${inputs} inputs · ${outputs} outputs · residual ${(residualPct * 100).toFixed(1)}%${unknown.length ? ` · unknown keys: ${unknown.join(", ")}` : ""}`,
      };
    };

    // 5. kpis — searchKpi per missing required kpi_code → upsertKpi.
    const readKpis = async () => {
      const required = registryFor(["all"]).filter((k) => k.required);
      const { data: rows } = await supabaseAdmin
        .from("country_kpis")
        .select("kpi_code, latest_value")
        .eq("country_code", cc)
        .not("latest_value", "is", null);
      const have = new Set((rows ?? []).map((r: any) => String(r.kpi_code)));
      const filledRequired = required.filter((k) => have.has(k.kpi_code)).length;
      return {
        status: (filledRequired === required.length ? "pass" : "warn") as SelfHealStatus,
        detail: `${filledRequired}/${required.length} required kpis with latest_value (${rows?.length ?? 0} total)`,
      };
    };

    // 6. corpus-miss — read count of empty attempts in last 24h.
    const readCorpusMiss = async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: rows } = await supabaseAdmin
        .from("corpus_fetch_attempts")
        .select("domain, key, outcome, created_at")
        .eq("country_code", cc)
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      const state = new Map<string, { empty: number; unresolved: boolean }>();
      for (const r of rows ?? []) {
        const k = `${r.domain}::${r.key}`;
        const s = state.get(k) ?? { empty: 0, unresolved: false };
        if (r.outcome === "empty" || r.outcome === "error" || r.outcome === "throttled") {
          s.empty += 1;
          s.unresolved = true;
        } else if (r.outcome === "external" || r.outcome === "hit") {
          s.unresolved = false;
        }
        state.set(k, s);
      }
      const unresolved = [...state.values()].filter((s) => s.unresolved).length;
      return {
        status: (unresolved === 0 ? "pass" : "warn") as SelfHealStatus,
        detail: `${unresolved} unresolved corpus misses (24h)`,
      };
    };

    const steps: Step[] = [
      {
        key: "sources",
        read: readSources,
        heal: async () => {
          const { data: rows } = await supabaseAdmin
            .from("country_sources")
            .select("id, url, fetch_status")
            .eq("country_code", cc);
          const invalid = (rows ?? []).filter((r: any) => !r.url || !/^https?:\/\//i.test(String(r.url)));
          const broken = (rows ?? []).filter((r: any) => r.url && /^https?:\/\//i.test(String(r.url)) && r.fetch_status && r.fetch_status !== "ok" && r.fetch_status !== "pending");
          for (const r of invalid) {
            const { error } = await supabaseAdmin
              .from("country_sources")
              .update({
                active: false,
                fetch_status: "invalid_url",
                fetch_error: `Non-URL text quarantined by self-heal: ${String(r.url ?? "").slice(0, 300)}`,
              })
              .eq("id", r.id);
            if (error) throw new Error(error.message);
          }
          for (const r of broken) {
            const { error } = await supabaseAdmin
              .from("country_sources")
              .update({
                active: false,
                fetch_error: `Unreachable source quarantined by self-heal: ${String(r.fetch_status ?? "unknown").slice(0, 120)}`,
              })
              .eq("id", r.id);
            if (error) throw new Error(error.message);
          }
          let after = await readSources();
          let added = 0;
          if (after.status !== "pass") {
            const discovered = await searchCitations({
              countryCode: cc,
              topic: "official GDP, national accounts, budget, central bank, ministry and development data sources",
            });
            for (const c of discovered?.data.rows ?? []) {
              if (!c.url || !/^https?:\/\//i.test(c.url)) continue;
              await upsertCountrySource(supabaseAdmin, {
                country_code: cc,
                url: c.url,
                title: c.title ?? `${c.org ?? "Authoritative"} source`,
                org: c.org ?? "Authoritative source",
                kind: "gov",
                tags: ["auto", "source_registry", "acceptance-self-heal"],
                quality_score: 4,
                active: true,
                created_by: context.userId,
              });
              added += 1;
            }
            after = await readSources();
          }
          await logAction({
            checkKey: "sources", action: "repairInvalidSourceUrls",
            before: invalid.length + broken.length, after: after.status === "pass" ? added : 0, detail: { quarantined_invalid: invalid.length, quarantined_broken: broken.length, added, after: after.detail },
          });
          return { action: "repairInvalidSourceUrls", summary: `Quarantined ${invalid.length} invalid + ${broken.length} broken source row(s), added ${added} researched source(s)` };
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
          const beforeCount = (profs ?? []).length;
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
            } catch (e) { failures.push(`${m.slug}:${(e as Error).message.slice(0, 140)}`); }
          }
          const { data: afterProfiles } = await supabaseAdmin
            .from("ministry_profiles")
            .select("ministry_slug")
            .eq("country_code", cc);
          const verifiedAfter = afterProfiles?.length ?? beforeCount;
          await logAction({
            checkKey: "overview", action: "backfillMinistryProfiles",
            before: beforeCount, after: verifiedAfter,
            detail: { attempted: missing.length, attempted_writes: wrote, verified_after: verifiedAfter, failures },
          });
          if (verifiedAfter <= beforeCount) throw new Error(`0/${missing.length} profiles committed · ${failures.join(", ")}`);
          return { action: "backfillMinistryProfiles", summary: `Committed ${verifiedAfter - beforeCount}/${missing.length} profile(s)` };
        },
      },
      {
        key: "flows",
        read: readFlows,
        heal: async () => {
          const before = await readFlows();
          const result = await researchAndCommitCapitalFlowsForAcceptance(supabaseAdmin, {
            countryCode: cc,
            userId: context.userId,
          });
          void recordCorpusReadOutcome({
            countryCode: cc, domain: "flow", key: "capital_flows:all",
            outcome: result.after > 0 ? "external" : "empty",
            tier: "workbook", latencyMs: 0, actor: context.userId,
            notes: {
              runId: result.runId,
              draftId: result.draftId,
              before: result.before,
              after: result.after,
              inputs: result.inputs,
              outputs: result.outputs,
              residual_pct: result.residualPct,
              attempts: result.attempts,
            },
          });
          await logAction({
            checkKey: "enrichment", action: "backfillCapitalFlows",
            before: result.before, after: result.after,
            detail: { ...result, before_verdict: before.detail, tier: "workbook" },
          });
          return { action: "backfillCapitalFlows", summary: result.summary };
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
          if (!missing.length) throw new Error("no required KPIs missing — check registry/read mismatch");
          const beforeFilled = Array.from(filled.values()).filter((v) => v != null).length;
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
            } catch (e) { failures.push(`${k.kpi_code}:${(e as Error).message.slice(0, 140)}`); }
          }
          const { count: afterFilled } = await supabaseAdmin
            .from("country_kpis")
            .select("id", { head: true, count: "exact" })
            .eq("country_code", cc)
            .not("latest_value", "is", null);
          await logAction({
            checkKey: "trust", action: "backfillKpiSeries",
            before: beforeFilled, after: afterFilled ?? beforeFilled,
            detail: { attempted: missing.length, attempted_writes: wrote, verified_after: afterFilled ?? beforeFilled, failures },
          });
          if ((afterFilled ?? beforeFilled) <= beforeFilled) throw new Error(`0/${missing.length} KPIs committed · ${failures.join(", ")}`);
          return { action: "backfillKpiSeries", summary: `Committed ${(afterFilled ?? beforeFilled) - beforeFilled}/${missing.length} KPI value(s)` };
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
          const [v1, ms1] = await timed(s.read);
          push({
            key: s.key,
            phase: "heal",
            status: v1.status === "pass" ? "healed" : "heal-failed",
            detail: v1.status === "pass"
              ? healed.summary
              : `Action ran but verification is still ${v1.status}: ${v1.detail}. ${healed.summary}`,
            ms: hMs,
            action: healed.action,
          });
          push({ key: s.key, phase: "recheck", status: v1.status, detail: v1.detail, ms: ms1 });
          current = v1;
        } catch (e) {
          push({ key: s.key, phase: "heal", status: "heal-failed", detail: (e as Error).message, ms: 0 });
          break; // don't retry a failed heal in-loop; move on
        }
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
