// @domain personas
// @tables portfolio_persona_sets,portfolio_persona_syntheses,ministry_portfolios,personas,countries,country_kpis
// @ui src/components/personas/portfolio/ConvenePanel.tsx; src/routes/_authenticated/admin/countries.$code.personas.portfolios.$setId.tsx
//
// Chamber 07 · Ministers track — talking to the profiles.
//
//   askIdealMinister  mirrors the profile in force for this country into a
//                     `personas` row (archetype ideal_minister:<CODE>, one per
//                     country and portfolio, updated in place) so the Lab's
//                     existing persona chat can address it.
//   convene           puts one question to the ideal ministers of the chosen
//                     portfolios and the ideal Prime Minister: each states a
//                     position from their profile; the Prime Minister
//                     arbitrates. A rehearsal, never a recommendation.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError, type AnyClient } from "@/lib/syndication/db";

import { officeNames, type IdealProfile, type PortfolioRow } from "./db";

function profileSummary(p: IdealProfile, label: string): string {
  return [
    `${p.title}. ${p.summary}`,
    `Traits: ${p.personality.traits.join("; ")}`,
    `Values: ${p.values.join("; ")}`,
    `How I decide: ${p.decision_model
      .map(
        (d) =>
          `${d.label} — weighs ${d.weighs.join(", ")}; horizon ${d.horizon}; risk ${d.risk_posture}; says no when ${d.says_no_when}`,
      )
      .join(" | ")}`,
    `Must-have skills: ${p.skill_stack
      .filter((s) => s.tier === "must_have")
      .map((s) => s.code)
      .join(", ")}`,
    `Failure modes I avoid: ${p.anti_patterns.join("; ")}`,
    p.portfolio_weighting?.length
      ? `How I weigh the portfolios: ${p.portfolio_weighting
          .map((w) => `${w.portfolio_code} (weight ${w.weight}): ${w.arbitration_rule}`)
          .join(" | ")}`
      : "",
    `Office: ${label}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const askIdealMinister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, portfolio: z.string().min(2).max(8) }), d),
  )
  .handler(async ({ data, context }): Promise<{ personaId: string; approved: boolean }> => {
    const sb = context.supabase as AnyClient;
    const c = db(sb);
    const { effectiveProfile, loadPortfolio } = await import("./engine.server");
    const [eff, portfolio] = await Promise.all([
      effectiveProfile(sb, data.code, data.portfolio, { allowDraft: true }),
      loadPortfolio(sb, data.portfolio),
    ]);
    if (!eff) throw new Error(`There is no ${portfolio.label} profile yet. Run one first.`);
    const p = eff.synthesis.profile as IdealProfile;
    const names = officeNames(portfolio);
    const archetype = names.archetype;
    const row = {
      country_code: data.code,
      name: names.ideal,
      archetype,
      summary: profileSummary(p, portfolio.label),
      attributes: {
        occupation: names.occupation,
        values: p.values,
        traits: p.personality.traits,
        decision_model: p.decision_model,
        skill_stack: p.skill_stack,
        anti_patterns: p.anti_patterns,
        stress_behaviours: p.stress_behaviours,
        source: {
          set_id: eff.set.id,
          synthesis_id: eff.synthesis.id,
          scope: eff.set.scope_key,
          version: eff.set.version,
          approved: eff.approved,
        },
      },
      ocean: Object.fromEntries(
        Object.entries(p.personality.ocean_target).map(([k, r]) => [
          k,
          Math.round((r.low + r.high) / 2),
        ]),
      ),
      grounding_refs: eff.synthesis.citations,
      origin: "ai",
      visibility: "public",
    };
    const { data: existing } = await c
      .from("personas")
      .select("id")
      .eq("country_code", data.code)
      .eq("archetype", archetype)
      .limit(1);
    const id = (existing as Array<{ id: string }> | null)?.[0]?.id;
    if (id) {
      const { error } = await c.from("personas").update(row).eq("id", id);
      if (error) throw governanceError(error);
      return { personaId: id, approved: eff.approved };
    }
    const { data: ins, error } = await c
      .from("personas")
      .insert({ ...row, owner_user_id: context.userId, owner_country_code: data.code })
      .select("id")
      .single();
    if (error) throw governanceError(error);
    return { personaId: (ins as { id: string }).id, approved: eff.approved };
  });

export interface ConveneResult {
  question: string;
  positions: Array<{
    portfolio_code: string;
    label: string;
    approved: boolean;
    position: string;
    weighs: string[];
    red_lines: string[];
  }>;
  pm: { approved: boolean; arbitration: string; decision: string; conditions: string[] } | null;
  missing: string[];
  model: string;
}

const ConveneSchema = z.object({
  positions: z.array(
    z.object({
      portfolio_code: z.string(),
      position: z.string(),
      weighs: z.array(z.string()),
      red_lines: z.array(z.string()),
    }),
  ),
  pm: z.object({ arbitration: z.string(), decision: z.string(), conditions: z.array(z.string()) }),
});

export const convene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        portfolios: z.array(z.string().min(2).max(8)).min(1).max(8),
        question: z.string().min(10).max(2000),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<ConveneResult> => {
    const sb = context.supabase as AnyClient;
    const c = db(sb);
    const { effectiveProfile } = await import("./engine.server");
    const { generateStructured, requireGatewayKey } = await import("@/lib/sector/model.server");
    requireGatewayKey();

    const codes = [...new Set(data.portfolios.filter((p) => p !== "PM"))];
    const [{ data: ports }, { data: country }] = await Promise.all([
      c
        .from("ministry_portfolios")
        .select("code,label,kind")
        .in("code", [...codes, "PM"]),
      c.from("countries").select("name").eq("code", data.code).maybeSingle(),
    ]);
    const label = new Map(((ports ?? []) as PortfolioRow[]).map((p) => [p.code, p.label]));
    const cname = (country as { name?: string } | null)?.name ?? data.code;

    const loaded = await Promise.all(
      [...codes, "PM"].map(async (code) => ({
        code,
        eff: await effectiveProfile(sb, data.code, code, { allowDraft: true }),
      })),
    );
    const present = loaded.filter((x) => x.eff);
    const missing = loaded.filter((x) => !x.eff).map((x) => label.get(x.code) ?? x.code);
    const ministers = present.filter((x) => x.code !== "PM");
    if (!ministers.length) throw new Error("None of the chosen portfolios has a profile yet.");
    const pm = present.find((x) => x.code === "PM");

    const { CORPUS_READERS } = await import("@/lib/egov/context.server");
    const country_lines = [
      ...(await CORPUS_READERS.country(sb, data.code).catch(() => [])),
      ...(await CORPUS_READERS.kpis(sb, data.code).catch(() => [])),
    ].slice(0, 30);

    const { out, model } = await generateStructured({
      schema: ConveneSchema,
      system: `You stage a rehearsal for GDPVision: the ideal ministers of a Caribbean government, each defined by an Ideal Minister Profile, respond to one question, and the ideal Prime Minister arbitrates. Speak from each profile — its values, decision model, red lines and skills — about ${cname}, using only the COUNTRY lines for facts. Never invent figures. This is a rehearsal to test an argument, not advice; positions should disagree where the profiles would. British/Caribbean spelling, plain prose.`,
      prompt: [
        `QUESTION: ${data.question}`,
        `COUNTRY (key | text)\n${country_lines.map((l) => `${l.key} | ${l.text}`).join("\n")}`,
        ...ministers.map(
          (x) =>
            `MINISTER ${x.code} — ${label.get(x.code) ?? x.code}\n${profileSummary(x.eff!.synthesis.profile as IdealProfile, label.get(x.code) ?? x.code)}`,
        ),
        pm
          ? `PRIME MINISTER\n${profileSummary(pm.eff!.synthesis.profile as IdealProfile, "Prime Minister")}`
          : "PRIME MINISTER: no profile yet — arbitrate as a careful head of government who must keep Cabinet together within a fixed fiscal envelope.",
        `Return one position per minister (portfolio_code exactly as given: ${ministers.map((x) => x.code).join(", ")}), then the Prime Minister's arbitration, decision and conditions.`,
      ].join("\n\n"),
      tag: `portfolio-convene:${data.code}`,
      maxOutputTokens: 6000,
    });

    return {
      question: data.question,
      positions: ministers.map((x) => {
        const p = out.positions.find((y) => y.portfolio_code === x.code);
        return {
          portfolio_code: x.code,
          label: label.get(x.code) ?? x.code,
          approved: x.eff!.approved,
          position: p?.position ?? "No position returned.",
          weighs: p?.weighs ?? [],
          red_lines: p?.red_lines ?? [],
        };
      }),
      pm: { approved: !!pm?.eff?.approved, ...out.pm },
      missing,
      model,
    };
  });
