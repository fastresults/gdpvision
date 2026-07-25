// @domain mandate-compact
// @tables mandate_compacts,compact_pillars,compact_pledges,compact_deliverables,ministries
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ compactId: z.string().uuid() });

export type CompactDeliverable = {
  id: string;
  pledge_id: string;
  lead_ministry_id: string | null;
  lead_ministry_name: string | null;
  title: string;
  theory_of_change: string | null;
  quarterly_milestones: Array<{ quarter: string; target: string; kpi?: string | null }>;
  risk_level: string | null;
  transformational_note: string | null;
};

export type CompactPledge = {
  id: string;
  pillar_id: string;
  title: string;
  verbatim_quote: string | null;
  pledge_type: string | null;
  baseline_value: number | null;
  target_value: number | null;
  unit: string | null;
  sort_order: number;
  deliverables: CompactDeliverable[];
};

export type CompactPillar = {
  id: string;
  title: string;
  narrative: string | null;
  color_token: string | null;
  sort_order: number;
  pledges: CompactPledge[];
};

export type CompactDetail = {
  id: string;
  country_code: string;
  title: string | null;
  pm_name: string | null;
  election_cycle: string;
  status: string;
  summary: string | null;
  visibility: string;
  manifesto_id: string | null;
  pillars: CompactPillar[];
};

export const getMandateCompactDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }): Promise<CompactDetail | null> => {
    const { supabase } = context;
    const { data: compact, error } = await supabase
      .from("mandate_compacts")
      .select("id, country_code, title, pm_name, election_cycle, status, summary, visibility, manifesto_id")
      .eq("id", data.compactId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!compact) return null;

    const [pillarsRes, pledgesRes, delivRes, minRes] = await Promise.all([
      supabase
        .from("compact_pillars")
        .select("id, title, narrative, color_token, sort_order")
        .eq("compact_id", compact.id)
        .order("sort_order"),
      supabase
        .from("compact_pledges")
        .select("id, pillar_id, title, verbatim_quote, pledge_type, baseline_value, target_value, unit, sort_order")
        .eq("compact_id", compact.id)
        .order("sort_order"),
      supabase
        .from("compact_deliverables")
        .select("id, pledge_id, lead_ministry_id, title, theory_of_change, quarterly_milestones, risk_level, transformational_note")
        .eq("compact_id", compact.id),
      supabase.from("ministries").select("id, name").eq("country_code", compact.country_code),
    ]);
    if (pillarsRes.error) throw new Error(pillarsRes.error.message);
    if (pledgesRes.error) throw new Error(pledgesRes.error.message);
    if (delivRes.error) throw new Error(delivRes.error.message);

    const minName = new Map<string, string>();
    for (const m of minRes.data ?? []) minName.set(m.id, m.name);

    const delivByPledge = new Map<string, CompactDeliverable[]>();
    for (const d of delivRes.data ?? []) {
      const list = delivByPledge.get(d.pledge_id) ?? [];
      list.push({
        id: d.id,
        pledge_id: d.pledge_id,
        lead_ministry_id: d.lead_ministry_id,
        lead_ministry_name: d.lead_ministry_id ? minName.get(d.lead_ministry_id) ?? null : null,
        title: d.title,
        theory_of_change: d.theory_of_change,
        quarterly_milestones: Array.isArray(d.quarterly_milestones) ? (d.quarterly_milestones as CompactDeliverable["quarterly_milestones"]) : [],
        risk_level: d.risk_level,
        transformational_note: d.transformational_note,
      });
      delivByPledge.set(d.pledge_id, list);
    }

    const pledgesByPillar = new Map<string, CompactPledge[]>();
    for (const p of pledgesRes.data ?? []) {
      const list = pledgesByPillar.get(p.pillar_id) ?? [];
      list.push({
        id: p.id,
        pillar_id: p.pillar_id,
        title: p.title,
        verbatim_quote: p.verbatim_quote,
        pledge_type: p.pledge_type,
        baseline_value: p.baseline_value,
        target_value: p.target_value,
        unit: p.unit,
        sort_order: p.sort_order,
        deliverables: delivByPledge.get(p.id) ?? [],
      });
      pledgesByPillar.set(p.pillar_id, list);
    }

    const pillars: CompactPillar[] = (pillarsRes.data ?? []).map((pi) => ({
      id: pi.id,
      title: pi.title,
      narrative: pi.narrative,
      color_token: pi.color_token,
      sort_order: pi.sort_order,
      pledges: pledgesByPillar.get(pi.id) ?? [],
    }));

    return { ...compact, pillars } as CompactDetail;
  });
