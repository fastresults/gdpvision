// Fact-check & citations (PRD §7.6 FR-NC-11, §12 screens 12/13).
// Extracts numeric claims from a draft body and matches them against the
// Ledger's series_points for the same country, and returns Second-Brain
// memory objects available as citations.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Numeric-claim extractor. Captures figures like:
//   "12.4%", "EC$412M", "USD 1.2 billion", "4,200", "45 percent"
const CLAIM_RE =
  /((?:EC\$|USD|US\$|\$)?\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?)(\s?(?:%|percent|million|billion|thousand|M|B|k))?/gi;

export interface Claim {
  raw: string;
  value: number;
  unit: "percent" | "currency" | "count" | "unknown";
  context: string;
  matches: Array<{ series_id: string; metric: string; unit: string; period: string; value: number; delta_pct: number }>;
}

export interface FactCheckReport {
  claims: Claim[];
  grounded: number;
  ungrounded: number;
}

function classify(raw: string, suffix?: string): { value: number; unit: Claim["unit"] } {
  const cleaned = raw.replace(/[,$\sA-Za-z]/g, "");
  let n = Number(cleaned);
  if (Number.isNaN(n)) return { value: 0, unit: "unknown" };
  const s = (suffix ?? "").trim().toLowerCase();
  if (s === "%" || s === "percent") return { value: n, unit: "percent" };
  if (s === "million" || s === "m") n *= 1_000_000;
  else if (s === "billion" || s === "b") n *= 1_000_000_000;
  else if (s === "thousand" || s === "k") n *= 1_000;
  const currency = /EC\$|USD|US\$|\$/.test(raw);
  return { value: n, unit: currency ? "currency" : "count" };
}

const FactCheckInput = z.object({
  scopeKey: z.string().min(3).max(16),
  body: z.string().max(50_000),
  tolerancePct: z.number().min(0.5).max(20).default(5),
});

export const factCheckBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FactCheckInput.parse(d))
  .handler(async ({ data, context }): Promise<FactCheckReport> => {
    // Extract candidate claims (dedupe by raw string).
    const seen = new Set<string>();
    const claims: Claim[] = [];
    for (const match of data.body.matchAll(CLAIM_RE)) {
      const raw = match[0].trim();
      if (!raw || seen.has(raw)) continue;
      // Require at least one digit and length > 1 to skip lone dollar signs etc.
      if (!/\d/.test(raw) || raw.length < 2) continue;
      seen.add(raw);
      const idx = match.index ?? 0;
      const start = Math.max(0, idx - 40);
      const end = Math.min(data.body.length, idx + raw.length + 40);
      const { value, unit } = classify(match[1], match[2]);
      claims.push({ raw, value, unit, context: data.body.slice(start, end), matches: [] });
    }

    if (claims.length === 0) return { claims: [], grounded: 0, ungrounded: 0 };

    // Pull recent Ledger values for the country. Join through series to filter.
    const { data: series, error: sErr } = await context.supabase
      .from("series")
      .select("id,metric,unit")
      .eq("country_code", data.scopeKey)
      .limit(400);
    if (sErr) throw new Error(sErr.message);
    const seriesById = new Map((series ?? []).map((s) => [s.id, s]));
    if (seriesById.size === 0) {
      return { claims, grounded: 0, ungrounded: claims.length };
    }

    const { data: points } = await context.supabase
      .from("series_points")
      .select("series_id,period,value")
      .in("series_id", Array.from(seriesById.keys()))
      .order("period", { ascending: false })
      .limit(2000);

    const tol = data.tolerancePct / 100;
    for (const c of claims) {
      if (c.unit === "unknown" || c.value === 0) continue;
      for (const p of points ?? []) {
        const v = Number(p.value);
        if (!Number.isFinite(v) || v === 0) continue;
        const delta = Math.abs(v - c.value) / Math.abs(v);
        if (delta <= tol) {
          const s = seriesById.get(p.series_id);
          if (!s) continue;
          c.matches.push({
            series_id: p.series_id,
            metric: s.metric,
            unit: s.unit,
            period: p.period,
            value: v,
            delta_pct: Number((delta * 100).toFixed(2)),
          });
          if (c.matches.length >= 3) break;
        }
      }
    }

    const grounded = claims.filter((c) => c.matches.length > 0).length;
    return { claims, grounded, ungrounded: claims.length - grounded };
  });

const CitationsInput = z.object({
  scopeKey: z.string().min(3).max(16),
  sectorCode: z.string().min(2).max(64).optional(),
  limit: z.number().int().min(1).max(50).default(15),
});

export interface CitationCandidate {
  ref: string;
  label: string;
  kind: string;
  sector_code: string;
  weight: number;
  verified: boolean;
}

export const listCitationCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CitationsInput.parse(d))
  .handler(async ({ data, context }): Promise<CitationCandidate[]> => {
    const { data: suppressions } = await context.supabase
      .from("source_suppressions")
      .select("source_id")
      .eq("scope_key", data.scopeKey)
      .eq("active", true);
    const suppressedIds = new Set((suppressions ?? []).map((s) => s.source_id));

    let q = context.supabase
      .from("memory_objects")
      .select("id,title,kind,sector_code,weight,verified,source_id")
      .eq("scope_key", data.scopeKey)
      .order("weight", { ascending: false, nullsFirst: false })
      .limit(data.limit * 2);
    if (data.sectorCode) q = q.eq("sector_code", data.sectorCode);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? [])
      .filter((r) => !r.source_id || !suppressedIds.has(r.source_id))
      .slice(0, data.limit)
      .map((r) => ({
        ref: `memory:${r.id}`,
        label: r.title,
        kind: r.kind as string,
        sector_code: r.sector_code,
        weight: r.weight ?? 3,
        verified: !!r.verified,
      }));
  });
