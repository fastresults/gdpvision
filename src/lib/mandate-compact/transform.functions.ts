// @domain mandate-compact
// @tables compact_pledges,compact_deliverables,ministries
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Transform — maps every pledge to a lead ministry with a
// McKinsey-grade theory of change, quarterly milestones, and a risk read.
// Idempotent per compact: wipes prior deliverables before re-inserting.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGeminiJson } from "@/lib/country-onboarding/gemini.server";

const Input = z.object({ compactId: z.string().uuid() });

type Milestone = { quarter: string; target: string; kpi?: string | null };

type TransformedDeliverable = {
  pledge_id: string;
  lead_ministry_slug: string | null;
  title: string;
  theory_of_change?: string | null;
  quarterly_milestones?: Milestone[];
  risk_level?: "low" | "medium" | "high" | "critical" | null;
  transformational_note?: string | null;
};

type TransformedShape = { deliverables: TransformedDeliverable[] };

export type TransformResult = {
  compact_id: string;
  deliverables_created: number;
  unassigned: number;
  model: string;
};

const SYSTEM =
  "You are a McKinsey Public Sector Partner. Convert political pledges into a ministry-owned delivery plan. Assign each pledge to the single best-fit lead ministry from the provided list. Every deliverable needs a theory of change, 4-8 quarterly milestones across the 5-year term, and a risk read. Be concrete, avoid platitudes, never invent ministries not in the list.";

function schemaHint(cycle: string) {
  return `{
  "deliverables": [
    {
      "pledge_id": "uuid · MUST match a pledge id from the input list",
      "lead_ministry_slug": "string · MUST match a slug from the ministries list, or null if truly none fit",
      "title": "string · action-oriented delivery title, 6-14 words",
      "theory_of_change": "string · 2-3 sentences: inputs → activities → outputs → outcome",
      "quarterly_milestones": [ { "quarter": "${cycle} Q1", "target": "string", "kpi": "string or null" } ],
      "risk_level": "low | medium | high | critical",
      "transformational_note": "string · one line on why this is transformational, not incremental"
    }
  ]
}`;
}

export const transformMandateCompact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }): Promise<TransformResult> => {
    const { supabase } = context;

    const { data: compact, error: cErr } = await supabase
      .from("mandate_compacts")
      .select("id, country_code, election_cycle, title, pm_name")
      .eq("id", data.compactId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!compact) throw new Error("Compact not found");

    const [pledgesRes, ministriesRes] = await Promise.all([
      supabase
        .from("compact_pledges")
        .select("id, title, verbatim_quote, pledge_type, baseline_value, target_value, unit, pillar_id")
        .eq("compact_id", data.compactId),
      supabase
        .from("ministries")
        .select("id, slug, name")
        .eq("country_code", compact.country_code)
        .order("sort_order"),
    ]);
    if (pledgesRes.error) throw new Error(pledgesRes.error.message);
    if (ministriesRes.error) throw new Error(ministriesRes.error.message);

    const pledges = pledgesRes.data ?? [];
    const ministries = ministriesRes.data ?? [];
    if (!pledges.length) throw new Error("No pledges yet — run Decompose first.");
    if (!ministries.length) throw new Error("No ministries on file for this country — run Stage 05 first.");

    const bySlug = new Map(ministries.map((m) => [m.slug, m]));
    const validPledgeIds = new Set(pledges.map((p) => p.id));

    const promptPayload = {
      country: compact.country_code,
      election_cycle: compact.election_cycle,
      prime_minister: compact.pm_name ?? null,
      ministries: ministries.map((m) => ({ slug: m.slug, name: m.name })),
      pledges: pledges.map((p) => ({
        id: p.id,
        title: p.title,
        quote: p.verbatim_quote,
        type: p.pledge_type,
        baseline: p.baseline_value,
        target: p.target_value,
        unit: p.unit,
      })),
    };

    const { parsed, content, model } = await callGeminiJson<TransformedShape>({
      system: SYSTEM,
      user: `Design the ministry-owned delivery plan for the ${compact.election_cycle} Mandate Compact.\n\nINPUT (JSON):\n${JSON.stringify(promptPayload, null, 2)}`,
      schemaHint: schemaHint(compact.election_cycle),
    });

    if (!parsed?.deliverables?.length) {
      throw new Error(`Transform failed to return deliverables (${model}): ${content.slice(0, 200)}`);
    }

    const { error: delErr } = await supabase
      .from("compact_deliverables")
      .delete()
      .eq("compact_id", data.compactId);
    if (delErr) throw new Error(`Failed to clear prior deliverables: ${delErr.message}`);

    const rows: any[] = [];
    let unassigned = 0;
    for (const d of parsed.deliverables) {
      if (!validPledgeIds.has(d.pledge_id)) continue;
      const ministry = d.lead_ministry_slug ? bySlug.get(d.lead_ministry_slug) : null;
      if (!ministry) unassigned++;
      const pledge = pledges.find((p) => p.id === d.pledge_id)!;
      const milestones = Array.isArray(d.quarterly_milestones) ? d.quarterly_milestones : [];
      rows.push({
        pledge_id: d.pledge_id,
        compact_id: data.compactId,
        country_code: compact.country_code,
        lead_ministry_id: ministry?.id ?? null,
        title: d.title || pledge.title,
        theory_of_change: d.theory_of_change ?? null,
        quarterly_milestones: milestones,
        risk_level: d.risk_level ?? null,
        transformational_note: d.transformational_note ?? null,
      });
    }

    if (rows.length) {
      const { error: insErr } = await supabase.from("compact_deliverables").insert(rows);
      if (insErr) throw new Error(`Deliverable insert failed: ${insErr.message}`);
    }

    return {
      compact_id: data.compactId,
      deliverables_created: rows.length,
      unassigned,
      model,
    };
  });
