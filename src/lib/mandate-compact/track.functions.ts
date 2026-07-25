// @domain mandate-compact
// @tables compact_status_updates,compact_scorecards,compact_deliverables,ministries
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Track — quarterly status updates + PM Report Card.
// Ministers/teams post a per-deliverable status update for a period; the
// scorecard job aggregates them into per-ministry scorecards, which the PM
// Report Card rolls up to the compact level.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StatusEnum = z.enum(["on_track", "at_risk", "off_track", "delivered", "broken"]);

const UpsertInput = z.object({
  deliverableId: z.string().uuid(),
  period: z.string().min(4).max(20), // e.g. "2025-Q2"
  status: StatusEnum,
  narrative: z.string().trim().max(4000).optional(),
  evidenceUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

const ComputeInput = z.object({
  compactId: z.string().uuid(),
  period: z.string().min(4).max(20),
});

const ListInput = z.object({ compactId: z.string().uuid() });

export type StatusStatus = z.infer<typeof StatusEnum>;

export type StatusUpdateRow = {
  id: string;
  deliverable_id: string;
  ministry_id: string | null;
  period: string;
  status: StatusStatus;
  narrative: string | null;
  evidence_url: string | null;
  created_at: string;
};

export type ScorecardRow = {
  id: string;
  compact_id: string;
  ministry_id: string | null;
  ministry_name: string | null;
  period: string;
  on_track_pct: number;
  at_risk_pct: number;
  off_track_pct: number;
  delivered_pct: number;
  broken_pct: number;
  weighted_progress: number;
  computed_at: string;
  deliverables_reported: number;
  deliverables_total: number;
};

export type PmReportCard = {
  compact_id: string;
  period: string | null;
  ministries: ScorecardRow[];
  totals: {
    deliverables_total: number;
    deliverables_reported: number;
    on_track_pct: number;
    at_risk_pct: number;
    off_track_pct: number;
    delivered_pct: number;
    broken_pct: number;
    weighted_progress: number;
  };
  recent_updates: StatusUpdateRow[];
  available_periods: string[];
};

// Scoring: delivered=1.0, on_track=0.8, at_risk=0.5, off_track=0.2, broken=0.
const WEIGHTS: Record<StatusStatus, number> = {
  delivered: 1,
  on_track: 0.8,
  at_risk: 0.5,
  off_track: 0.2,
  broken: 0,
};

export const upsertDeliverableStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => UpsertInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: d, error: dErr } = await supabase
      .from("compact_deliverables")
      .select("id, compact_id, country_code, lead_ministry_id, visibility, owner_country_code")
      .eq("id", data.deliverableId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!d) throw new Error("Deliverable not found");

    const payload = {
      deliverable_id: d.id,
      compact_id: d.compact_id,
      country_code: d.country_code,
      ministry_id: d.lead_ministry_id,
      reported_by: userId,
      period: data.period,
      status: data.status,
      evidence_url: data.evidenceUrl ?? null,
      narrative: data.narrative ?? null,
      visibility: d.visibility ?? "public",
      owner_country_code: d.owner_country_code ?? d.country_code,
      uploaded_by: userId,
    };

    const { data: row, error } = await supabase
      .from("compact_status_updates")
      .insert(payload)
      .select("id, deliverable_id, ministry_id, period, status, narrative, evidence_url, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as StatusUpdateRow;
  });

export const computeScorecards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ComputeInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: compact, error: cErr } = await supabase
      .from("mandate_compacts")
      .select("id, country_code, visibility, owner_country_code")
      .eq("id", data.compactId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!compact) throw new Error("Compact not found");

    const { data: delivs, error: delErr } = await supabase
      .from("compact_deliverables")
      .select("id, lead_ministry_id")
      .eq("compact_id", data.compactId);
    if (delErr) throw new Error(delErr.message);

    const { data: updates, error: uErr } = await supabase
      .from("compact_status_updates")
      .select("deliverable_id, ministry_id, status, created_at")
      .eq("compact_id", data.compactId)
      .eq("period", data.period)
      .order("created_at", { ascending: false });
    if (uErr) throw new Error(uErr.message);

    // Keep the latest status per deliverable for this period.
    const latestByDeliverable = new Map<string, { status: StatusStatus; ministry_id: string | null }>();
    for (const u of updates ?? []) {
      if (!latestByDeliverable.has(u.deliverable_id)) {
        latestByDeliverable.set(u.deliverable_id, {
          status: u.status as StatusStatus,
          ministry_id: u.ministry_id,
        });
      }
    }

    const byMinistry = new Map<
      string,
      { ministry_id: string | null; total: number; counts: Record<StatusStatus, number> }
    >();
    for (const d of delivs ?? []) {
      const key = d.lead_ministry_id ?? "__unassigned__";
      const b = byMinistry.get(key) ?? {
        ministry_id: d.lead_ministry_id,
        total: 0,
        counts: { on_track: 0, at_risk: 0, off_track: 0, delivered: 0, broken: 0 },
      };
      b.total += 1;
      const u = latestByDeliverable.get(d.id);
      if (u) b.counts[u.status] += 1;
      byMinistry.set(key, b);
    }

    // Wipe prior rows for this compact+period to keep idempotent.
    await supabase
      .from("compact_scorecards")
      .delete()
      .eq("compact_id", data.compactId)
      .eq("period", data.period);

    const rows = [...byMinistry.values()].map((b) => {
      const reported =
        b.counts.on_track + b.counts.at_risk + b.counts.off_track + b.counts.delivered + b.counts.broken;
      const denom = b.total || 1;
      const pct = (n: number) => Math.round((n / denom) * 1000) / 10;
      const weighted =
        (b.counts.delivered * WEIGHTS.delivered +
          b.counts.on_track * WEIGHTS.on_track +
          b.counts.at_risk * WEIGHTS.at_risk +
          b.counts.off_track * WEIGHTS.off_track +
          b.counts.broken * WEIGHTS.broken) /
        denom;
      return {
        compact_id: data.compactId,
        country_code: compact.country_code,
        ministry_id: b.ministry_id,
        period: data.period,
        on_track_pct: pct(b.counts.on_track),
        at_risk_pct: pct(b.counts.at_risk),
        off_track_pct: pct(b.counts.off_track),
        delivered_pct: pct(b.counts.delivered),
        broken_pct: pct(b.counts.broken),
        weighted_progress: Math.round(weighted * 1000) / 10,
        visibility: compact.visibility ?? "public",
        owner_country_code: compact.owner_country_code ?? compact.country_code,
        computed_at: new Date().toISOString(),
        // stash the reported/total in _deliverables via extra select in getPmReportCard
      };
    });

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("compact_scorecards").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { period: data.period, ministries_scored: rows.length };
  });

export const getPmReportCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ListInput.parse(raw))
  .handler(async ({ data, context }): Promise<PmReportCard> => {
    const { supabase } = context;

    const { data: compact, error: cErr } = await supabase
      .from("mandate_compacts")
      .select("id, country_code")
      .eq("id", data.compactId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!compact) throw new Error("Compact not found");

    const [scRes, updRes, delivRes, minRes] = await Promise.all([
      supabase
        .from("compact_scorecards")
        .select("id, compact_id, ministry_id, period, on_track_pct, at_risk_pct, off_track_pct, delivered_pct, broken_pct, weighted_progress, computed_at")
        .eq("compact_id", data.compactId)
        .order("period", { ascending: false }),
      supabase
        .from("compact_status_updates")
        .select("id, deliverable_id, ministry_id, period, status, narrative, evidence_url, created_at")
        .eq("compact_id", data.compactId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("compact_deliverables").select("id, lead_ministry_id").eq("compact_id", data.compactId),
      supabase.from("ministries").select("id, name").eq("country_code", compact.country_code),
    ]);
    if (scRes.error) throw new Error(scRes.error.message);
    if (updRes.error) throw new Error(updRes.error.message);
    if (delivRes.error) throw new Error(delivRes.error.message);

    const ministryName = new Map<string, string>();
    for (const m of minRes.data ?? []) ministryName.set(m.id, m.name);

    const availablePeriods = Array.from(new Set((scRes.data ?? []).map((s) => s.period)));
    const latestPeriod = availablePeriods[0] ?? null;
    const latestRows = (scRes.data ?? []).filter((s) => s.period === latestPeriod);

    // Reported / total per ministry for the latest period.
    const totalPerMin = new Map<string, number>();
    for (const d of delivRes.data ?? []) {
      const k = d.lead_ministry_id ?? "__unassigned__";
      totalPerMin.set(k, (totalPerMin.get(k) ?? 0) + 1);
    }
    const reportedPerMin = new Map<string, Set<string>>();
    for (const u of updRes.data ?? []) {
      if (u.period !== latestPeriod) continue;
      const k = u.ministry_id ?? "__unassigned__";
      const set = reportedPerMin.get(k) ?? new Set<string>();
      set.add(u.deliverable_id);
      reportedPerMin.set(k, set);
    }

    const ministries: ScorecardRow[] = latestRows.map((s) => {
      const key = s.ministry_id ?? "__unassigned__";
      return {
        id: s.id,
        compact_id: s.compact_id,
        ministry_id: s.ministry_id,
        ministry_name: s.ministry_id ? ministryName.get(s.ministry_id) ?? "Unknown" : "Unassigned",
        period: s.period,
        on_track_pct: Number(s.on_track_pct ?? 0),
        at_risk_pct: Number(s.at_risk_pct ?? 0),
        off_track_pct: Number(s.off_track_pct ?? 0),
        delivered_pct: Number(s.delivered_pct ?? 0),
        broken_pct: Number(s.broken_pct ?? 0),
        weighted_progress: Number(s.weighted_progress ?? 0),
        computed_at: s.computed_at,
        deliverables_reported: reportedPerMin.get(key)?.size ?? 0,
        deliverables_total: totalPerMin.get(key) ?? 0,
      };
    });

    const total = (delivRes.data ?? []).length;
    const reported = ministries.reduce((s, m) => s + m.deliverables_reported, 0);
    const wsum = (fn: (m: ScorecardRow) => number) =>
      ministries.reduce((s, m) => s + fn(m) * m.deliverables_total, 0) / (total || 1);

    return {
      compact_id: data.compactId,
      period: latestPeriod,
      ministries: ministries.sort((a, b) => a.ministry_name!.localeCompare(b.ministry_name!)),
      totals: {
        deliverables_total: total,
        deliverables_reported: reported,
        on_track_pct: Math.round(wsum((m) => m.on_track_pct) * 10) / 10,
        at_risk_pct: Math.round(wsum((m) => m.at_risk_pct) * 10) / 10,
        off_track_pct: Math.round(wsum((m) => m.off_track_pct) * 10) / 10,
        delivered_pct: Math.round(wsum((m) => m.delivered_pct) * 10) / 10,
        broken_pct: Math.round(wsum((m) => m.broken_pct) * 10) / 10,
        weighted_progress: Math.round(wsum((m) => m.weighted_progress) * 10) / 10,
      },
      recent_updates: (updRes.data ?? []) as StatusUpdateRow[],
      available_periods: availablePeriods,
    };
  });
