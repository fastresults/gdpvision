// @domain mandate-compact
// @tables compact_transformational_plans,mandate_compacts,compact_pillars,compact_pledges,compact_deliverables,ministries,intake_items,strategy_statements,narrative_lineage
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Step 08 — Transformational Plan.
// Synthesizes tracks 01–07 (manifesto → pillars → pledges → ministry
// delivery → scorecards → ministries digest → publish) into one
// cabinet-ready, citation-backed document, and hands the executive
// summary off to Chamber 05 (Narrative) as a first-class signal +
// strategy statement so Comms can generate channel drafts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGeminiJson } from "@/lib/country-onboarding/gemini.server";
import type { Json } from "@/integrations/supabase/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PlanSectionKind =
  | "executive_overture"
  | "mandate_in_numbers"
  | "pillar"
  | "ministry_delivery"
  | "milestone_ladder"
  | "risk_resilience"
  | "measurement_cadence"
  | "stakeholder_compact"
  | "appendix";

export type PlanSection = {
  id: string;
  kind: PlanSectionKind;
  heading: string;
  body_md: string;
  eyebrow?: string | null;
  data_refs?: Record<string, unknown>;
};

export type PlanMetrics = {
  pillars: number;
  pledges: number;
  deliverables: number;
  ministries_engaged: number;
  horizon: string | null;
  gdp_delta_headline?: string | null;
};

export type PlanCitation = {
  label: string;
  ref: string;
};

export type TransformationalPlan = {
  id: string;
  compact_id: string;
  country_code: string;
  version: number;
  status: "draft" | "cabinet_review" | "approved" | "published";
  title: string | null;
  subtitle: string | null;
  sections: PlanSection[];
  metrics: PlanMetrics;
  sources: PlanCitation[];
  narrative_signal_id: string | null;
  narrative_strategy_id: string | null;
  model: string | null;
  authored_at: string;
  approved_at: string | null;
  published_at: string | null;
};

function coerceSections(raw: unknown): PlanSection[] {
  return Array.isArray(raw) ? (raw as PlanSection[]) : [];
}
function coerceCitations(raw: unknown): PlanCitation[] {
  return Array.isArray(raw) ? (raw as PlanCitation[]) : [];
}
function coerceMetrics(raw: unknown): PlanMetrics {
  const r = (raw ?? {}) as Partial<PlanMetrics>;
  return {
    pillars: r.pillars ?? 0,
    pledges: r.pledges ?? 0,
    deliverables: r.deliverables ?? 0,
    ministries_engaged: r.ministries_engaged ?? 0,
    horizon: r.horizon ?? null,
    gdp_delta_headline: r.gdp_delta_headline ?? null,
  };
}

function rowToPlan(row: any): TransformationalPlan {
  return {
    id: row.id,
    compact_id: row.compact_id,
    country_code: row.country_code,
    version: row.version,
    status: row.status,
    title: row.title,
    subtitle: row.subtitle,
    sections: coerceSections(row.sections),
    metrics: coerceMetrics(row.metrics),
    sources: coerceCitations(row.sources),
    narrative_signal_id: row.narrative_signal_id,
    narrative_strategy_id: row.narrative_strategy_id,
    model: row.model,
    authored_at: row.authored_at,
    approved_at: row.approved_at,
    published_at: row.published_at,
  };
}

// ─── List / Get ─────────────────────────────────────────────────────────────

export const listTransformationalPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ compactId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<TransformationalPlan[]> => {
    const { data: rows, error } = await context.supabase
      .from("compact_transformational_plans")
      .select("*")
      .eq("compact_id", data.compactId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(rowToPlan);
  });

export const getTransformationalPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        compactId: z.string().uuid(),
        version: z.number().int().positive().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<TransformationalPlan | null> => {
    let q = context.supabase
      .from("compact_transformational_plans")
      .select("*")
      .eq("compact_id", data.compactId);
    if (data.version) q = q.eq("version", data.version);
    else q = q.order("version", { ascending: false }).limit(1);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return null;
    return rowToPlan(rows[0]);
  });

// ─── Generate ───────────────────────────────────────────────────────────────

const SYSTEM =
  "You are a McKinsey Public Sector Partner drafting the internal Transformational Plan for a sovereign cabinet. The audience is the Prime Minister and Cabinet — the tone is confident, McKinsey-pyramid (answer-first, MECE), plain-English, and specific. Every claim must be grounded in the supplied pledges, deliverables, and ministry assignments. Never invent numbers, ministries, or citations. Prefer verbs over adjectives.";

type AiPlanSection = {
  id?: string;
  kind: PlanSectionKind | string;
  heading: string;
  eyebrow?: string | null;
  body_md: string;
};
type AiPlanShape = {
  title?: string;
  subtitle?: string;
  sections: AiPlanSection[];
  gdp_delta_headline?: string;
};

function planSchemaHint(cycle: string) {
  return `{
  "title": "string · plan title, e.g. 'Transformational Plan for ${cycle}'",
  "subtitle": "string · one-line thesis of the mandate",
  "gdp_delta_headline": "string · optional one-line expected GDP or growth headline",
  "sections": [
    {
      "id": "kebab-case unique id",
      "kind": "one of: executive_overture | mandate_in_numbers | pillar | ministry_delivery | milestone_ladder | risk_resilience | measurement_cadence | stakeholder_compact | appendix",
      "heading": "string · section heading, 3-9 words",
      "eyebrow": "string · optional short mono eyebrow (e.g. 'Pillar 02', 'First 100 days')",
      "body_md": "markdown body · use short paragraphs, ## subheads only inside body if needed, no h1"
    }
  ]
}`;
}

export const generateTransformationalPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ compactId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<TransformationalPlan> => {
    const { supabase } = context;

    const { data: compact, error: cErr } = await supabase
      .from("mandate_compacts")
      .select("id, country_code, election_cycle, title, pm_name, summary")
      .eq("id", data.compactId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!compact) throw new Error("Compact not found");

    const [pillarsRes, pledgesRes, delivRes, ministriesRes] = await Promise.all([
      supabase
        .from("compact_pillars")
        .select("id, title, narrative, sort_order")
        .eq("compact_id", data.compactId)
        .order("sort_order"),
      supabase
        .from("compact_pledges")
        .select(
          "id, pillar_id, title, verbatim_quote, pledge_type, baseline_value, target_value, unit, sort_order",
        )
        .eq("compact_id", data.compactId)
        .order("sort_order"),
      supabase
        .from("compact_deliverables")
        .select(
          "id, pledge_id, lead_ministry_id, title, theory_of_change, quarterly_milestones, risk_level, transformational_note",
        )
        .eq("compact_id", data.compactId),
      supabase
        .from("ministries")
        .select("id, slug, name")
        .eq("country_code", compact.country_code),
    ]);
    if (pillarsRes.error) throw new Error(pillarsRes.error.message);
    if (pledgesRes.error) throw new Error(pledgesRes.error.message);
    if (delivRes.error) throw new Error(delivRes.error.message);
    if (ministriesRes.error) throw new Error(ministriesRes.error.message);

    const pillars = pillarsRes.data ?? [];
    const pledges = pledgesRes.data ?? [];
    const deliverables = delivRes.data ?? [];
    const ministries = ministriesRes.data ?? [];

    if (pillars.length === 0)
      throw new Error("No pillars — run Decompose first.");
    if (deliverables.length === 0)
      throw new Error("No deliverables — run Transform first.");

    const ministryName = new Map(ministries.map((m) => [m.id, m.name]));
    const ministriesEngaged = new Set(
      deliverables.map((d) => d.lead_ministry_id).filter(Boolean) as string[],
    ).size;

    const promptPayload = {
      country: compact.country_code,
      election_cycle: compact.election_cycle,
      prime_minister: compact.pm_name ?? null,
      manifesto_summary: compact.summary ?? null,
      pillars: pillars.map((pi) => ({
        id: pi.id,
        title: pi.title,
        narrative: pi.narrative,
        pledges: pledges
          .filter((p) => p.pillar_id === pi.id)
          .map((p) => ({
            id: p.id,
            title: p.title,
            quote: p.verbatim_quote,
            baseline: p.baseline_value,
            target: p.target_value,
            unit: p.unit,
            deliverables: deliverables
              .filter((d) => d.pledge_id === p.id)
              .map((d) => ({
                title: d.title,
                lead_ministry:
                  (d.lead_ministry_id && ministryName.get(d.lead_ministry_id)) ||
                  null,
                theory_of_change: d.theory_of_change,
                milestones: d.quarterly_milestones,
                risk: d.risk_level,
                transformational_note: d.transformational_note,
              })),
          })),
      })),
    };

    const { parsed, content, model } = await callGeminiJson<AiPlanShape>({
      system: SYSTEM,
      user: `Draft the Transformational Plan for the ${compact.election_cycle} Mandate Compact. Produce a McKinsey-pyramid document with these sections in order: (1) executive_overture — one section, situation → complication → mandate → transformation thesis; (2) mandate_in_numbers — one section summarising the scale of the mandate; (3) pillar — one section PER PILLAR listed below, each grounded in that pillar's pledges + deliverables; (4) ministry_delivery — one section grouping deliverables by owning ministry; (5) milestone_ladder — First 100 days / First 12 months / Full-term horizon; (6) risk_resilience — one section on the top delivery risks; (7) measurement_cadence — one section on scorecard cadence and review rhythm; (8) stakeholder_compact — one section addressing cabinet, parliament, citizens, diaspora, investors; (9) appendix — one section listing the pillars and how many pledges each carries.\n\nINPUT (JSON):\n${JSON.stringify(promptPayload, null, 2)}`,
      schemaHint: planSchemaHint(compact.election_cycle),
    });

    if (!parsed?.sections?.length) {
      throw new Error(
        `Transformational Plan generation returned no sections (${model}): ${content.slice(0, 200)}`,
      );
    }

    // Normalize sections: ensure ids, coerce kinds to allowed set.
    const allowedKinds: PlanSectionKind[] = [
      "executive_overture",
      "mandate_in_numbers",
      "pillar",
      "ministry_delivery",
      "milestone_ladder",
      "risk_resilience",
      "measurement_cadence",
      "stakeholder_compact",
      "appendix",
    ];
    const sections: PlanSection[] = parsed.sections.map((s, i) => {
      const kind = allowedKinds.includes(s.kind as PlanSectionKind)
        ? (s.kind as PlanSectionKind)
        : ("appendix" as PlanSectionKind);
      return {
        id: (s.id && String(s.id)) || `sec-${i + 1}`,
        kind,
        heading: String(s.heading || "").trim() || `Section ${i + 1}`,
        eyebrow: s.eyebrow ?? null,
        body_md: String(s.body_md || "").trim(),
      };
    });

    const metrics: PlanMetrics = {
      pillars: pillars.length,
      pledges: pledges.length,
      deliverables: deliverables.length,
      ministries_engaged: ministriesEngaged,
      horizon: compact.election_cycle ?? null,
      gdp_delta_headline: parsed.gdp_delta_headline ?? null,
    };

    // Source list = ministries + horizon; the corpus/onboarding_citations
    // integration is Slice-C. For now we surface pillar titles as anchors so
    // the report is honest about what grounded it.
    const sources: PlanCitation[] = pillars.map((p, i) => ({
      label: `Pillar ${String(i + 1).padStart(2, "0")} · ${p.title}`,
      ref: `#pillar-${i + 1}`,
    }));

    // Compute next version
    const { data: latest } = await supabase
      .from("compact_transformational_plans")
      .select("version")
      .eq("compact_id", data.compactId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;

    const { data: inserted, error: insErr } = await supabase
      .from("compact_transformational_plans")
      .insert({
        compact_id: data.compactId,
        country_code: compact.country_code,
        version: nextVersion,
        status: "draft",
        title: parsed.title ?? `Transformational Plan · ${compact.election_cycle}`,
        subtitle: parsed.subtitle ?? compact.title ?? null,
        sections: sections as unknown as Json,
        metrics: metrics as unknown as Json,
        sources: sources as unknown as Json,
        model,
        authored_by: context.userId,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);
    return rowToPlan(inserted);
  });

// ─── Approve / Publish ──────────────────────────────────────────────────────

export const approveTransformationalPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<TransformationalPlan> => {
    const { data: row, error } = await context.supabase
      .from("compact_transformational_plans")
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToPlan(row);
  });

export const publishTransformationalPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<TransformationalPlan> => {
    const { data: row, error } = await context.supabase
      .from("compact_transformational_plans")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToPlan(row);
  });

// ─── Handoff to Chamber 05 · Narrative ─────────────────────────────────────

export const handoffPlanToNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid() }).parse(raw),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      planId: string;
      signalId: string;
      strategyId: string;
    }> => {
      const { supabase } = context;
      const { data: plan, error } = await supabase
        .from("compact_transformational_plans")
        .select("*")
        .eq("id", data.id)
        .single();
      if (error) throw new Error(error.message);
      const p = rowToPlan(plan);

      const exec = p.sections.find((s) => s.kind === "executive_overture");
      const stakeholder = p.sections.find(
        (s) => s.kind === "stakeholder_compact",
      );
      const ministry = p.sections.find((s) => s.kind === "ministry_delivery");
      const milestone = p.sections.find((s) => s.kind === "milestone_ladder");
      const risk = p.sections.find((s) => s.kind === "risk_resilience");

      // 1. Signal in intake_items
      const topic =
        p.title ?? `Transformational Plan · ${p.metrics.horizon ?? ""}`;
      const summary = exec?.body_md?.slice(0, 1800) ?? p.subtitle ?? "";
      const { data: signal, error: sigErr } = await supabase
        .from("intake_items")
        .insert({
          scope_key: p.country_code,
          sector_code: "gov",
          topic,
          summary,
          proposed_weight: 5,
          final_weight: 5,
          state: "accepted",
          story_primary: true,
        })
        .select("id")
        .single();
      if (sigErr) throw new Error(sigErr.message);

      // 2. Strategy statement seeded from plan
      const sevenPart = {
        situation: exec?.body_md ?? "",
        complication: risk?.body_md ?? "",
        question: `How does the ${p.metrics.horizon ?? "current"} mandate translate into transformation for ${p.country_code}?`,
        answer: p.subtitle ?? p.title ?? "",
        grounds: ministry?.body_md ?? "",
        warrant: milestone?.body_md ?? "",
        call: stakeholder?.body_md ?? "",
      };
      const sources = p.sources.map((s) => ({ label: s.label, ref: s.ref }));
      const { data: strategy, error: stratErr } = await supabase
        .from("strategy_statements")
        .insert({
          scope_key: p.country_code,
          sector_code: "gov",
          title: topic,
          seven_part: sevenPart as unknown as Json,
          sources: sources as unknown as Json,
          status: "draft",
          version: 1,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (stratErr) throw new Error(stratErr.message);

      // 3. Lineage row so DraftStudio sees the connection
      try {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        await supabaseAdmin.from("narrative_lineage").insert({
          signal_id: signal.id,
          artifact_type: "strategy",
          artifact_id: strategy.id,
          scope_key: p.country_code,
          sector_code: "gov",
          created_by: context.userId,
        });
      } catch {
        /* lineage best-effort */
      }

      // 4. Write-back on plan
      await supabase
        .from("compact_transformational_plans")
        .update({
          narrative_signal_id: signal.id,
          narrative_strategy_id: strategy.id,
        })
        .eq("id", p.id);

      return { planId: p.id, signalId: signal.id, strategyId: strategy.id };
    },
  );
