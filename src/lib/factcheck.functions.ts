// Fact-check & citations (PRD §7.6 FR-NC-11, §12 screens 12/13).
// Extracts numeric claims from a draft body and matches them against the
// Ledger's series_points for the same country.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applySourceSuppressions } from "@/lib/suppressions.server";

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

type ClaimSeverity = "green" | "amber" | "red";

export interface ClaimCheck extends Claim {
  severity: ClaimSeverity;
}

export interface FactCheckReport {
  mode: "generation" | "approval";
  claims: ClaimCheck[];
  grounded: number;
  ungrounded: number;
  blocking: number; // red claims (approval only)
  overridable: number; // amber claims (approval only, can be overridden)
}

const FactCheckInput = z.object({
  scopeKey: z.string().min(3).max(16),
  body: z.string().max(50_000),
  tolerancePct: z.number().min(0.5).max(20).default(5),
  mode: z.enum(["generation", "approval"]).default("generation"),
});

export const factCheckBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FactCheckInput.parse(d))
  .handler(async ({ data, context }): Promise<FactCheckReport> => {
    // Extract candidate claims (dedupe by raw string).
    const seen = new Set<string>();
    const claims: ClaimCheck[] = [];
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
      claims.push({ raw, value, unit, context: data.body.slice(start, end), matches: [], severity: "red" });
    }

    if (claims.length === 0) return { mode: data.mode, claims: [], grounded: 0, ungrounded: 0, blocking: 0, overridable: 0 };

    // Pull recent Ledger values for the country. Join through series to filter.
    const { data: series, error: sErr } = await context.supabase
      .from("series")
      .select("id,metric,unit")
      .eq("country_code", data.scopeKey)
      .limit(400);
    if (sErr) throw new Error(sErr.message);
    const seriesById = new Map((series ?? []).map((s) => [s.id, s]));
    if (seriesById.size === 0) {
      return { mode: data.mode, claims, grounded: 0, ungrounded: claims.length, blocking: claims.length, overridable: 0 };
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

    for (const c of claims) {
      if (c.matches.length > 0) {
        // Green if within half tolerance, amber otherwise.
        const bestDelta = Math.min(...c.matches.map((m) => m.delta_pct));
        c.severity = bestDelta <= data.tolerancePct / 2 ? "green" : "amber";
      } else {
        c.severity = data.mode === "approval" ? "red" : "amber";
      }
    }

    const grounded = claims.filter((c) => c.matches.length > 0).length;
    const blocking = data.mode === "approval" ? claims.filter((c) => c.severity === "red").length : 0;
    const overridable = data.mode === "approval" ? claims.filter((c) => c.severity === "amber").length : 0;
    return {
      mode: data.mode,
      claims,
      grounded,
      ungrounded: claims.length - grounded,
      blocking,
      overridable,
    };
  });

// Approval gate: throws if blocking claims exist and no override reason is supplied.
// If an override is supplied, the disputed claims are written to data_revisions as a
// paper trail for later audit.
const ApproveCheckInput = z.object({
  scopeKey: z.string().min(3).max(16),
  body: z.string().max(50_000),
  tolerancePct: z.number().min(0.5).max(20).default(5),
  overrideReason: z.string().max(500).optional(),
  artifactId: z.string().uuid().optional(),
  artifactType: z.enum(["strategy", "comms", "counsel"]).optional(),
});

export const assertApprovalFactCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApproveCheckInput.parse(d))
  .handler(async ({ data, context }) => {
    const report = await factCheckBody({
      data: {
        scopeKey: data.scopeKey,
        body: data.body,
        tolerancePct: data.tolerancePct,
        mode: "approval",
      },
    });

    if (report.blocking === 0) {
      return { ok: true, report, overridden: false };
    }

    if (!data.overrideReason || data.overrideReason.length < 8) {
      throw new Error(
        `Approval blocked: ${report.blocking} Ledger claim(s) cannot be matched. Provide an override reason to proceed.`
      );
    }

    // Paper trail: write the override to data_revisions.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const c of report.claims.filter((c) => c.severity === "red")) {
      const { error } = await supabaseAdmin.from("data_revisions").insert({
        scope_key: data.scopeKey,
        table_name: data.artifactType ? `${data.artifactType}_artifact` : "unknown",
        record_id: data.artifactId ?? null,
        field_name: "fact_check_override",
        old_value: { raw: c.raw, matches: c.matches } as any,
        new_value: { override_reason: data.overrideReason, severity: c.severity } as any,
        reason: data.overrideReason,
        reviewed_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true, report, overridden: true };
  });

// Re-export from citations module so existing imports can migrate in one place.
export { listCitationCandidates } from "@/lib/citations.functions";
