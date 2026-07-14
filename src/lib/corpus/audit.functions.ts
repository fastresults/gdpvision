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
