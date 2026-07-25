// @domain mandate-compact
// @tables mandate_compacts,compact_pillars,compact_pledges,compact_deliverables,compact_revisions,compact_scorecards,compact_status_updates,ministries
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx, src/routes/_authenticated/console.$code.mandate.tsx
//
// Chamber 08 · Slice D — Publish, sign, activate, conclude.
// Also exposes a country-scoped read for the Country Console PM Report Card.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompactDetail } from "./detail.functions";
import type { PmReportCard, ScorecardRow, StatusStatus, StatusUpdateRow } from "./track.functions";

const CompactIdInput = z.object({
  compactId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
});
const CountryInput = z.object({ countryCode: z.string().min(2).max(3) });

type CompactStatus = "draft" | "signed" | "in_force" | "concluded" | "superseded";

const TRANSITIONS: Record<CompactStatus, CompactStatus[]> = {
  draft: ["signed"],
  signed: ["in_force", "superseded"],
  in_force: ["concluded", "superseded"],
  concluded: [],
  superseded: [],
};

async function loadDetailSnapshot(supabase: any, compactId: string) {
  const [compactRes, pillarsRes, pledgesRes, delivsRes, minRes] = await Promise.all([
    supabase
      .from("mandate_compacts")
      .select("id, country_code, election_cycle, title, pm_name, status, summary, visibility, signed_at, term_start, term_end, manifesto_id, governing_party_id, updated_at")
      .eq("id", compactId)
      .maybeSingle(),
    supabase
      .from("compact_pillars")
      .select("id, compact_id, title, narrative, color_token, sort_order")
      .eq("compact_id", compactId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("compact_pledges")
      .select("id, pillar_id, title, verbatim_quote, pledge_type, baseline_value, target_value, unit, sort_order")
      .eq("compact_id", compactId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("compact_deliverables")
      .select("id, pledge_id, lead_ministry_id, title, theory_of_change, quarterly_milestones, risk_level, transformational_note")
      .eq("compact_id", compactId),
    supabase.from("ministries").select("id, name, slug"),
  ]);
  if (compactRes.error) throw new Error(compactRes.error.message);
  if (!compactRes.data) throw new Error("Compact not found");
  if (pillarsRes.error) throw new Error(pillarsRes.error.message);
  if (pledgesRes.error) throw new Error(pledgesRes.error.message);
  if (delivsRes.error) throw new Error(delivsRes.error.message);

  const ministryName = new Map<string, string>();
  for (const m of minRes.data ?? []) ministryName.set(m.id, m.name);

  const delivsByPledge = new Map<string, any[]>();
  for (const d of delivsRes.data ?? []) {
    const arr = delivsByPledge.get(d.pledge_id) ?? [];
    arr.push({
      ...d,
      lead_ministry_name: d.lead_ministry_id ? ministryName.get(d.lead_ministry_id) ?? null : null,
      quarterly_milestones: Array.isArray(d.quarterly_milestones) ? d.quarterly_milestones : [],
    });
    delivsByPledge.set(d.pledge_id, arr);
  }

  const pledgesByPillar = new Map<string, any[]>();
  for (const pl of pledgesRes.data ?? []) {
    const arr = pledgesByPillar.get(pl.pillar_id) ?? [];
    arr.push({ ...pl, deliverables: delivsByPledge.get(pl.id) ?? [] });
    pledgesByPillar.set(pl.pillar_id, arr);
  }

  const pillars = ((pillarsRes.data ?? []) as any[]).map((p: any) => ({
    ...p,
    pledges: pledgesByPillar.get(p.id) ?? [],
  }));

  return { compact: compactRes.data, pillars };
}

async function assertWriteAccess(supabase: any, userId: string, countryCode: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return;
  const { data: hasCountry } = await supabase.rpc("has_country_access", {
    _user_id: userId,
    _country_code: countryCode,
  });
  if (!hasCountry) throw new Error("Forbidden: country access required to publish this compact");
}

async function nextRevisionNumber(supabase: any, compactId: string): Promise<number> {
  const { data, error } = await supabase
    .from("compact_revisions")
    .select("revision_number")
    .eq("compact_id", compactId)
    .order("revision_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0]?.revision_number ?? 0) + 1;
}

async function transitionCompact(
  compactId: string,
  target: CompactStatus,
  reason: string | undefined,
  supabase: any,
  userId: string,
) {
  const { data: current, error } = await supabase
    .from("mandate_compacts")
    .select("id, country_code, status, visibility, owner_country_code")
    .eq("id", compactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) throw new Error("Compact not found");
  await assertWriteAccess(supabase, userId, current.country_code);

  const from = current.status as CompactStatus;
  if (from === target) {
    return { ok: true, from, to: target, revision_number: null as number | null, unchanged: true };
  }
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(target)) {
    throw new Error(`Cannot move compact from "${from}" to "${target}"`);
  }

  const patch: Record<string, any> = { status: target };
  if (target === "signed") {
    patch.signed_at = new Date().toISOString();
  }

  const { error: upErr } = await supabase.from("mandate_compacts").update(patch).eq("id", compactId);
  if (upErr) throw new Error(upErr.message);

  // Snapshot the whole compact tree for audit / diff.
  const snap = await loadDetailSnapshot(supabase, compactId);
  const revision_number = await nextRevisionNumber(supabase, compactId);
  const { error: revErr } = await supabase.from("compact_revisions").insert({
    compact_id: compactId,
    country_code: current.country_code,
    revision_number,
    reason: reason ?? `Transition ${from} → ${target}`,
    snapshot: { transition: { from, to: target }, compact: snap.compact, pillars: snap.pillars },
    editor_id: userId,
    visibility: current.visibility ?? "public",
    owner_country_code: current.owner_country_code ?? current.country_code,
  });
  if (revErr) throw new Error(revErr.message);

  return { ok: true, from, to: target, revision_number, unchanged: false };
}

export const signMandateCompact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CompactIdInput.parse(raw))
  .handler(async ({ data, context }) =>
    transitionCompact(data.compactId, "signed", data.reason, context.supabase, context.userId),
  );

export const activateMandateCompact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CompactIdInput.parse(raw))
  .handler(async ({ data, context }) =>
    transitionCompact(data.compactId, "in_force", data.reason, context.supabase, context.userId),
  );

export const concludeMandateCompact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CompactIdInput.parse(raw))
  .handler(async ({ data, context }) =>
    transitionCompact(data.compactId, "concluded", data.reason, context.supabase, context.userId),
  );

// ── Country Console read ────────────────────────────────────────────────
// Returns the active (in_force → signed → draft) compact for a country with
// full detail + a PM Report Card rolled up over the latest scored period.

export type PublicMandateCompact = {
  compact: CompactDetail | null;
  report: PmReportCard | null;
};

export const getActiveMandateCompact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CountryInput.parse(raw))
  .handler(async ({ data, context }): Promise<PublicMandateCompact> => {
    const { supabase } = context;

    // Prefer in_force, then signed, then latest draft.
    const { data: rows, error } = await supabase
      .from("mandate_compacts")
      .select("id, country_code, election_cycle, title, pm_name, status, summary, visibility, manifesto_id, updated_at")
      .eq("country_code", data.countryCode)
      .in("status", ["in_force", "signed", "draft"])
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const pick =
      rows?.find((r) => r.status === "in_force") ??
      rows?.find((r) => r.status === "signed") ??
      rows?.[0] ??
      null;
    if (!pick) return { compact: null, report: null };

    const snap = await loadDetailSnapshot(supabase, pick.id);
    const compact: CompactDetail = {
      id: pick.id,
      country_code: pick.country_code,
      title: pick.title,
      pm_name: pick.pm_name,
      election_cycle: pick.election_cycle,
      status: pick.status,
      summary: pick.summary,
      visibility: pick.visibility,
      manifesto_id: pick.manifesto_id,
      pillars: snap.pillars as CompactDetail["pillars"],
    };

    // Report card — latest scored period.
    const [scRes, updRes, delivRes, minRes] = await Promise.all([
      supabase
        .from("compact_scorecards")
        .select("id, compact_id, ministry_id, period, on_track_pct, at_risk_pct, off_track_pct, delivered_pct, broken_pct, weighted_progress, computed_at")
        .eq("compact_id", pick.id)
        .order("period", { ascending: false }),
      supabase
        .from("compact_status_updates")
        .select("id, deliverable_id, ministry_id, period, status, narrative, evidence_url, created_at")
        .eq("compact_id", pick.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("compact_deliverables").select("id, lead_ministry_id").eq("compact_id", pick.id),
      supabase.from("ministries").select("id, name").eq("country_code", pick.country_code),
    ]);
    if (scRes.error) throw new Error(scRes.error.message);
    if (updRes.error) throw new Error(updRes.error.message);
    if (delivRes.error) throw new Error(delivRes.error.message);

    const availablePeriods = Array.from(new Set((scRes.data ?? []).map((r) => r.period))).sort((a, b) =>
      b.localeCompare(a),
    );
    const latest = availablePeriods[0] ?? null;
    const scorecardsForPeriod = latest ? (scRes.data ?? []).filter((r) => r.period === latest) : [];

    const ministryName = new Map<string, string>();
    for (const m of minRes.data ?? []) ministryName.set(m.id, m.name);

    const delivsByMinistry = new Map<string, number>();
    for (const d of delivRes.data ?? []) {
      const k = d.lead_ministry_id ?? "__unassigned__";
      delivsByMinistry.set(k, (delivsByMinistry.get(k) ?? 0) + 1);
    }

    // Enrich scorecard rows with names + totals.
    const ministries: ScorecardRow[] = scorecardsForPeriod.map((r) => {
      const k = r.ministry_id ?? "__unassigned__";
      const total = delivsByMinistry.get(k) ?? 0;
      const reportedPct =
        r.delivered_pct + r.on_track_pct + r.at_risk_pct + r.off_track_pct + r.broken_pct;
      const reported = Math.round((reportedPct / 100) * total);
      return {
        id: r.id,
        compact_id: r.compact_id,
        ministry_id: r.ministry_id,
        ministry_name: r.ministry_id ? ministryName.get(r.ministry_id) ?? "Unknown" : "Unassigned",
        period: r.period,
        on_track_pct: r.on_track_pct,
        at_risk_pct: r.at_risk_pct,
        off_track_pct: r.off_track_pct,
        delivered_pct: r.delivered_pct,
        broken_pct: r.broken_pct,
        weighted_progress: r.weighted_progress,
        computed_at: r.computed_at,
        deliverables_reported: reported,
        deliverables_total: total,
      };
    });

    const totals = ministries.reduce(
      (acc, m) => {
        acc.deliverables_total += m.deliverables_total;
        acc.deliverables_reported += m.deliverables_reported;
        acc.weighted += m.weighted_progress * (m.deliverables_total || 1);
        acc.delivered += m.delivered_pct * (m.deliverables_total || 1);
        acc.on_track += m.on_track_pct * (m.deliverables_total || 1);
        acc.at_risk += m.at_risk_pct * (m.deliverables_total || 1);
        acc.off_track += m.off_track_pct * (m.deliverables_total || 1);
        acc.broken += m.broken_pct * (m.deliverables_total || 1);
        acc.weight += m.deliverables_total || 1;
        return acc;
      },
      { deliverables_total: 0, deliverables_reported: 0, weighted: 0, delivered: 0, on_track: 0, at_risk: 0, off_track: 0, broken: 0, weight: 0 },
    );
    const w = totals.weight || 1;

    const report: PmReportCard = {
      compact_id: pick.id,
      period: latest,
      ministries: ministries.sort((a, b) => b.weighted_progress - a.weighted_progress),
      totals: {
        deliverables_total: totals.deliverables_total,
        deliverables_reported: totals.deliverables_reported,
        weighted_progress: Math.round((totals.weighted / w) * 10) / 10,
        delivered_pct: Math.round((totals.delivered / w) * 10) / 10,
        on_track_pct: Math.round((totals.on_track / w) * 10) / 10,
        at_risk_pct: Math.round((totals.at_risk / w) * 10) / 10,
        off_track_pct: Math.round((totals.off_track / w) * 10) / 10,
        broken_pct: Math.round((totals.broken / w) * 10) / 10,
      },
      recent_updates: (updRes.data ?? []) as StatusUpdateRow[],
      available_periods: availablePeriods,
    };

    return { compact, report };
  });
