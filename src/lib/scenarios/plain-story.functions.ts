// @domain scenarios
// @tables scenarios,countries
// @ui src/components/scenarios/v3/StoryPanel.tsx

// Turns an engine output into a plain-English cabinet-ready story:
// one headline + 3 bullets (what happens / who feels it / what could offset).
// Cached in the scenario's assumptions.plain_story so subsequent renders are free.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EngineOutput } from "@/lib/engine/v1_macro";

const Input = z.object({
  scenarioId: z.string().uuid(),
  force: z.boolean().optional(),
});

export interface PlainStory {
  headline: string;
  what_happens: string;
  who_feels_it: string;
  what_could_offset: string;
  confidence: string;
  generated_at: string;
}

function summarizeEngine(output: EngineOutput): string {
  const first = output.gdpGrowthPath[0];
  const last = output.gdpGrowthPath[output.gdpGrowthPath.length - 1];
  const topSectors = [...output.sectorImpacts]
    .sort((a, b) => Math.abs(b.delta_pp) - Math.abs(a.delta_pp))
    .slice(0, 5)
    .map((s) => `${s.sector_code} ${s.delta_pp >= 0 ? "+" : ""}${s.delta_pp.toFixed(2)}pp`)
    .join(", ");
  const topLevers = [...output.attribution]
    .sort((a, b) => Math.abs(b.contribution_pp) - Math.abs(a.contribution_pp))
    .slice(0, 4)
    .map((a) => `${a.lever_slug}:${a.contribution_pp >= 0 ? "+" : ""}${a.contribution_pp.toFixed(2)}pp`)
    .join(", ");
  return [
    `Horizon years: ${output.years.length} (${output.years[0]}–${output.years[output.years.length - 1]})`,
    `GDP growth path P50: ${first?.p50.toFixed(2)}% → ${last?.p50.toFixed(2)}% (P10 ${last?.p10.toFixed(2)} / P90 ${last?.p90.toFixed(2)})`,
    `Top sector shifts: ${topSectors || "(none)"}`,
    `Top drivers: ${topLevers || "(none)"}`,
  ].join("\n");
}

export const generatePlainStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }): Promise<{ story: PlainStory | null; note?: string }> => {
    const { supabase } = context;

    const { data: s } = await supabase
      .from("scenarios")
      .select("id,title,country_code,assumptions,results,horizon_years")
      .eq("id", data.scenarioId)
      .maybeSingle();
    if (!s) return { story: null, note: "Scenario not found" };

    const assumptions = (s.assumptions ?? {}) as Record<string, unknown>;
    const cached = assumptions.plain_story as PlainStory | undefined;
    if (cached && !data.force) return { story: cached };

    const results = (s.results ?? {}) as EngineOutput | Record<string, never>;
    if (!("years" in results)) {
      return { story: null, note: "Scenario has no engine results yet." };
    }
    const engineResults = results as EngineOutput;

    const { data: country } = await supabase
      .from("countries")
      .select("name")
      .eq("code", s.country_code)
      .maybeSingle();

    const question = String(assumptions.question_text ?? s.title);
    const thesis = String(assumptions.thesis ?? "");
    const engineSummary = summarizeEngine(results);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { story: null, note: "AI Gateway not configured" };

    const prompt = [
      `You brief the ${country?.name ?? s.country_code} Cabinet. Ministers read this on their phone.`,
      "Turn the following scenario into ONE plain-English headline plus three tight bullets.",
      "No jargon. No words like elasticity, tornado, attribution, compensation, counterfactual, horizon, P50.",
      "Numbers are OK. Percentages are OK. Say 'most likely' instead of P50.",
      "",
      `MINISTER'S QUESTION: "${question}"`,
      thesis ? `SCENARIO THESIS: ${thesis}` : "",
      "",
      "ENGINE OUTPUT:",
      engineSummary,
      "",
      "Return STRICT JSON only, matching:",
      `{
  "headline": "one sentence, <= 160 chars, states the outcome in plain English",
  "what_happens": "1-2 sentences, ministerial tone, cites the number",
  "who_feels_it": "1-2 sentences, name ministries/sectors most affected",
  "what_could_offset": "1-2 sentences, concrete policy move a minister could pull",
  "confidence": "one sentence: how sure we are and why"
}`,
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          {
            role: "system",
            content:
              "You brief sovereign cabinets in plain English. Respond with strict JSON only, no markdown.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { story: null, note: `AI Gateway ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { story: null, note: "AI response could not be parsed." };
    }

    const story: PlainStory = {
      headline: String(parsed.headline ?? "").slice(0, 280),
      what_happens: String(parsed.what_happens ?? "").slice(0, 600),
      who_feels_it: String(parsed.who_feels_it ?? "").slice(0, 600),
      what_could_offset: String(parsed.what_could_offset ?? "").slice(0, 600),
      confidence: String(parsed.confidence ?? "").slice(0, 400),
      generated_at: new Date().toISOString(),
    };

    // Cache back into assumptions.
    await supabase
      .from("scenarios")
      .update({ assumptions: { ...assumptions, plain_story: story } })
      .eq("id", data.scenarioId);

    return { story };
  });
