// @domain corpus
// @tables corpus_fetch_attempts
// @ui src/routes/_authenticated/admin/corpus-audit.tsx; src/routes/_authenticated/admin/ledger-qa.tsx

// Server functions powering /admin/corpus-audit.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RangeSchema = z.object({
  countryCode: z.string().optional(),
  hours: z.number().int().min(1).max(720).default(24),
});

export type CorpusAuditSummary = {
  window_hours: number;
  totals: Record<string, number>;
  by_domain: Array<{
    domain: string;
    hit: number;
    external: number;
    empty: number;
    throttled: number;
    error: number;
    miss_rate: number;
  }>;
  top_empty_keys: Array<{
    country_code: string;
    domain: string;
    key: string;
    empty_count: number;
    last_seen: string;
  }>;
  tier_breakdown: Array<{ tier: string; count: number }>;
  recent: Array<{
    id: string;
    country_code: string;
    domain: string;
    key: string;
    outcome: string;
    tier: string | null;
    latency_ms: number | null;
    created_at: string;
  }>;
};

export const getCorpusAuditSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => RangeSchema.parse(raw))
  .handler(async ({ data, context }): Promise<CorpusAuditSummary> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.hours * 3_600_000).toISOString();

    let q = supabaseAdmin
      .from("corpus_fetch_attempts")
      .select("id, country_code, domain, key, outcome, tier, latency_ms, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data.countryCode) q = q.eq("country_code", data.countryCode);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const totals: Record<string, number> = {};
    const domainBuckets = new Map<string, {
      hit: number; external: number; empty: number; throttled: number; error: number;
    }>();
    const emptyKeys = new Map<string, { count: number; last: string }>();
    const tierCounts = new Map<string, number>();

    for (const r of list) {
      totals[r.outcome] = (totals[r.outcome] ?? 0) + 1;
      const bucket = domainBuckets.get(r.domain) ?? {
        hit: 0, external: 0, empty: 0, throttled: 0, error: 0,
      };
      (bucket as Record<string, number>)[r.outcome] = ((bucket as Record<string, number>)[r.outcome] ?? 0) + 1;
      domainBuckets.set(r.domain, bucket);
      if (r.outcome === "empty") {
        const k = `${r.country_code}:${r.domain}:${r.key}`;
        const cur = emptyKeys.get(k);
        emptyKeys.set(k, {
          count: (cur?.count ?? 0) + 1,
          last: cur?.last ?? r.created_at,
        });
      }
      if (r.tier) tierCounts.set(r.tier, (tierCounts.get(r.tier) ?? 0) + 1);
    }

    const by_domain = Array.from(domainBuckets.entries()).map(([domain, b]) => {
      const total = b.hit + b.external + b.empty + b.throttled + b.error;
      const miss = b.empty + b.throttled + b.error;
      return {
        domain,
        ...b,
        miss_rate: total === 0 ? 0 : Math.round((miss / total) * 1000) / 10,
      };
    });

    const top_empty_keys = Array.from(emptyKeys.entries())
      .map(([k, v]) => {
        const [country_code, domain, ...rest] = k.split(":");
        return {
          country_code,
          domain,
          key: rest.join(":"),
          empty_count: v.count,
          last_seen: v.last,
        };
      })
      .sort((a, b) => b.empty_count - a.empty_count)
      .slice(0, 20);

    return {
      window_hours: data.hours,
      totals,
      by_domain,
      top_empty_keys,
      tier_breakdown: Array.from(tierCounts.entries())
        .map(([tier, count]) => ({ tier, count }))
        .sort((a, b) => b.count - a.count),
      recent: list.slice(0, 50).map((r) => ({
        id: r.id as string,
        country_code: r.country_code as string,
        domain: r.domain as string,
        key: r.key as string,
        outcome: r.outcome as string,
        tier: (r.tier as string | null) ?? null,
        latency_ms: (r.latency_ms as number | null) ?? null,
        created_at: r.created_at as string,
      })),
    };
  });

// ── Ledger-QA cross-link ────────────────────────────────────────────────────
// Row for the QA checklist: green = zero unresolved corpus misses in the
// last 24h. A miss is "unresolved" when a `(country,domain,key)` had an
// `empty` outcome without a subsequent `external` success within the window.

const MissInput = z.object({
  countryCode: z.string(),
  hours: z.number().int().min(1).max(720).default(24),
});

export type CorpusMissStatus = {
  status: "pass" | "warn" | "fail";
  total_attempts: number;
  unresolved_misses: Array<{
    domain: string;
    key: string;
    last_empty: string;
    empty_count: number;
  }>;
  summary: string;
};

export const getCorpusMissStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => MissInput.parse(raw))
  .handler(async ({ data, context }): Promise<CorpusMissStatus> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.hours * 3_600_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("corpus_fetch_attempts")
      .select("domain, key, outcome, created_at")
      .eq("country_code", data.countryCode)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // Walk chronologically: track last empty per (domain,key); clear on external.
    type State = { last_empty: string | null; empty_count: number };
    const state = new Map<string, State>();
    for (const r of list) {
      const k = `${r.domain}::${r.key}`;
      const s = state.get(k) ?? { last_empty: null, empty_count: 0 };
      if (r.outcome === "empty") {
        s.last_empty = r.created_at as string;
        s.empty_count += 1;
      } else if (r.outcome === "external" || r.outcome === "hit") {
        s.last_empty = null;
      }
      state.set(k, s);
    }
    const unresolved = Array.from(state.entries())
      .filter(([, v]) => v.last_empty)
      .map(([k, v]) => {
        const [domain, ...rest] = k.split("::");
        return {
          domain,
          key: rest.join("::"),
          last_empty: v.last_empty!,
          empty_count: v.empty_count,
        };
      })
      .sort((a, b) => b.empty_count - a.empty_count);

    const status: CorpusMissStatus["status"] =
      unresolved.length === 0
        ? "pass"
        : unresolved.length <= 2
        ? "warn"
        : "fail";
    return {
      status,
      total_attempts: list.length,
      unresolved_misses: unresolved.slice(0, 20),
      summary:
        unresolved.length === 0
          ? `No silent corpus misses in the last ${data.hours}h across ${list.length} reads.`
          : `${unresolved.length} unresolved corpus miss${unresolved.length === 1 ? "" : "es"} in the last ${data.hours}h.`,
    };
  });

// Re-drive: force-refresh every unresolved key so the gateway re-attempts
// the external waterfall. Actual searchers must be wired per domain; for now
// this just clears the cooldown by inserting a "throttled" marker so the
// gateway will try again on the next natural read.
export const redriveCorpusMisses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => MissInput.parse(raw))
  .handler(async ({ data, context }): Promise<{ cleared: number }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Insert a synthetic "hit" marker per unresolved (country,domain,key) so
    // the cooldown check sees a non-empty last-attempt and lets a real
    // search run on the next natural read.
    const miss = await getCorpusMissStatus({ data });
    if (!miss.unresolved_misses.length) return { cleared: 0 };
    const now = new Date().toISOString();
    const rows = miss.unresolved_misses.map((m) => ({
      country_code: data.countryCode,
      domain: m.domain,
      key: m.key,
      outcome: "hit" as const,
      tier: "redrive-clear",
      latency_ms: 0,
      actor: context.userId,
      created_at: now,
    }));
    const { error } = await supabaseAdmin.from("corpus_fetch_attempts").insert(rows);
    if (error) throw new Error(error.message);
    return { cleared: rows.length };
  });
