// @domain mandate-compact
// @tables mandate_compacts,compact_pillars,compact_pledges,compact_deliverables,compact_status_updates,ministries
// @ui src/components/mandate-compact/MinistriesPanel.tsx

// Chamber 08 · Slice F — Ministry drilldown.
// For a compact, roll up every deliverable by its lead ministry, attach the
// latest status per deliverable, and surface an at-risk digest so the PM can
// see which ministries own the compact's weakest promises.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ compactId: z.string().uuid() });

export type MinistryDeliverableView = {
  deliverable_id: string;
  pledge_id: string;
  pledge_title: string;
  pillar_id: string;
  pillar_title: string;
  pillar_color: string | null;
  deliverable_title: string;
  risk_level: string | null;
  latest_status: string | null;
  latest_period: string | null;
  latest_narrative: string | null;
  latest_evidence_url: string | null;
  latest_reported_at: string | null;
};

export type MinistryRollup = {
  ministry_id: string | null;
  ministry_name: string;
  deliverables_total: number;
  deliverables_reported: number;
  counts: {
    on_track: number;
    at_risk: number;
    off_track: number;
    delivered: number;
    broken: number;
    unreported: number;
  };
  weighted_progress: number;
  at_risk_titles: string[];
  deliverables: MinistryDeliverableView[];
};

export type CompactMinistriesView = {
  compact_id: string;
  country_code: string;
  ministries: MinistryRollup[];
};

const WEIGHTS: Record<string, number> = {
  delivered: 1,
  on_track: 0.8,
  at_risk: 0.5,
  off_track: 0.2,
  broken: 0,
};

export const getCompactMinistriesView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }): Promise<CompactMinistriesView> => {
    const { supabase } = context;

    const { data: compact, error: cErr } = await supabase
      .from("mandate_compacts")
      .select("id, country_code")
      .eq("id", data.compactId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!compact) throw new Error("Compact not found");

    const [pillarsRes, pledgesRes, delivRes, updRes, minRes] = await Promise.all([
      supabase.from("compact_pillars").select("id, title, color_token").eq("compact_id", compact.id),
      supabase.from("compact_pledges").select("id, pillar_id, title").eq("compact_id", compact.id),
      supabase
        .from("compact_deliverables")
        .select("id, pledge_id, lead_ministry_id, title, risk_level")
        .eq("compact_id", compact.id),
      supabase
        .from("compact_status_updates")
        .select("deliverable_id, status, period, narrative, evidence_url, created_at")
        .eq("compact_id", compact.id)
        .order("created_at", { ascending: false }),
      supabase.from("ministries").select("id, name").eq("country_code", compact.country_code),
    ]);
    if (pillarsRes.error) throw new Error(pillarsRes.error.message);
    if (pledgesRes.error) throw new Error(pledgesRes.error.message);
    if (delivRes.error) throw new Error(delivRes.error.message);
    if (updRes.error) throw new Error(updRes.error.message);

    const pillarById = new Map((pillarsRes.data ?? []).map((p) => [p.id, p]));
    const pledgeById = new Map((pledgesRes.data ?? []).map((p) => [p.id, p]));
    const ministryName = new Map((minRes.data ?? []).map((m) => [m.id, m.name]));

    // Latest status per deliverable
    const latest = new Map<string, { status: string; period: string; narrative: string | null; evidence_url: string | null; created_at: string }>();
    for (const u of updRes.data ?? []) {
      if (!latest.has(u.deliverable_id)) {
        latest.set(u.deliverable_id, {
          status: u.status,
          period: u.period,
          narrative: u.narrative,
          evidence_url: u.evidence_url,
          created_at: u.created_at,
        });
      }
    }

    // Group deliverables by ministry
    const byMinistry = new Map<string, MinistryRollup>();
    for (const d of delivRes.data ?? []) {
      const key = d.lead_ministry_id ?? "__unassigned__";
      const bucket =
        byMinistry.get(key) ??
        ({
          ministry_id: d.lead_ministry_id,
          ministry_name: d.lead_ministry_id ? ministryName.get(d.lead_ministry_id) ?? "Unknown ministry" : "Unassigned",
          deliverables_total: 0,
          deliverables_reported: 0,
          counts: { on_track: 0, at_risk: 0, off_track: 0, delivered: 0, broken: 0, unreported: 0 },
          weighted_progress: 0,
          at_risk_titles: [],
          deliverables: [],
        } as MinistryRollup);

      const pledge = pledgeById.get(d.pledge_id);
      const pillar = pledge ? pillarById.get(pledge.pillar_id) : undefined;
      const l = latest.get(d.id) ?? null;

      bucket.deliverables_total += 1;
      if (l) {
        bucket.deliverables_reported += 1;
        const s = l.status as keyof typeof bucket.counts;
        if (s in bucket.counts) bucket.counts[s] += 1;
        if (s === "at_risk" || s === "off_track" || s === "broken") {
          bucket.at_risk_titles.push(d.title);
        }
      } else {
        bucket.counts.unreported += 1;
      }

      bucket.deliverables.push({
        deliverable_id: d.id,
        pledge_id: d.pledge_id,
        pledge_title: pledge?.title ?? "Unknown pledge",
        pillar_id: pledge?.pillar_id ?? "",
        pillar_title: pillar?.title ?? "Unknown pillar",
        pillar_color: pillar?.color_token ?? null,
        deliverable_title: d.title,
        risk_level: d.risk_level,
        latest_status: l?.status ?? null,
        latest_period: l?.period ?? null,
        latest_narrative: l?.narrative ?? null,
        latest_evidence_url: l?.evidence_url ?? null,
        latest_reported_at: l?.created_at ?? null,
      });
      byMinistry.set(key, bucket);
    }

    // Compute weighted progress per ministry (delivered=1, on_track=.8, at_risk=.5, off_track=.2, broken=0; unreported doesn't count toward denom).
    for (const b of byMinistry.values()) {
      const denom = b.deliverables_reported || 1;
      const weighted =
        (b.counts.delivered * WEIGHTS.delivered +
          b.counts.on_track * WEIGHTS.on_track +
          b.counts.at_risk * WEIGHTS.at_risk +
          b.counts.off_track * WEIGHTS.off_track +
          b.counts.broken * WEIGHTS.broken) /
        denom;
      b.weighted_progress = Math.round(weighted * 1000) / 10;
      b.deliverables.sort((a, z) => {
        const rank = (s: string | null) =>
          s === "broken" ? 0 : s === "off_track" ? 1 : s === "at_risk" ? 2 : s === null ? 3 : s === "on_track" ? 4 : 5;
        return rank(a.latest_status) - rank(z.latest_status);
      });
    }

    const ministries = [...byMinistry.values()].sort((a, b) => {
      // Weakest ministries first — biggest lever for the PM.
      if (a.deliverables_reported === 0 && b.deliverables_reported === 0) return 0;
      if (a.deliverables_reported === 0) return 1;
      if (b.deliverables_reported === 0) return -1;
      return a.weighted_progress - b.weighted_progress;
    });

    return { compact_id: compact.id, country_code: compact.country_code, ministries };
  });
