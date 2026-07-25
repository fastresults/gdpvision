// @domain scenarios
// @tables scenarios,levers,country_sectors,exposure_index,ministries
// @ui src/routes/_authenticated/admin/countries.$code.scenarios.index.tsx

// One-shot "What if…" entry point for Chamber 03 v3. Takes a plain-English
// question, runs the existing AI recommender, and persists a draft scenario
// via saveScenario. Returns the new scenario id so the UI can navigate to it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runScenarioEngine, saveScenario } from "@/lib/scenarios.functions";
import { recommendScenario } from "@/lib/scenarios/recommend-scenario.functions";

const AskInput = z.object({
  countryCode: z.string().min(3).max(4),
  question: z.string().min(3).max(1200),
  horizonYearsHint: z.number().int().min(1).max(10).optional(),
});

export const askAndCreateScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AskInput.parse(data))
  .handler(async ({ data }): Promise<{ id: string | null; note?: string }> => {
    // 1. Hydrate lever defs via the engine (no persistence).
    const init = await runScenarioEngine({
      data: {
        countryCode: data.countryCode,
        horizonYears: data.horizonYearsHint ?? 5,
        levers: {},
      },
    });

    if (init.leverDefs.length === 0) {
      return {
        id: null,
        note: "This country has no policy levers configured yet. Complete Stage 12 of onboarding first.",
      };
    }

    // 2. Ask the AI to translate the question into a full scenario.
    const rec = await recommendScenario({
      data: {
        countryCode: data.countryCode,
        challenge: data.question,
        horizonYearsHint: data.horizonYearsHint,
        leverDefs: init.leverDefs.map((d) => ({
          slug: d.slug,
          sector_code: d.sector_code,
          response_fn_ref: d.response_fn_ref,
          bounds: d.bounds,
        })),
      },
    });

    if (!rec.scenario) {
      return { id: null, note: rec.note ?? "AI could not shape this question into a scenario." };
    }

    // 3. Persist the draft with the original question in assumptions.
    const saved = await saveScenario({
      data: {
        countryCode: data.countryCode,
        title: rec.scenario.title,
        horizonYears: rec.scenario.horizonYears,
        levers: rec.scenario.levers,
        assumptions: {
          question_text: data.question,
          thesis: rec.scenario.thesis,
          play: rec.scenario.playbook,
          moves: rec.scenario.moves,
          risks: rec.scenario.risks,
          assumptions_list: rec.scenario.assumptions,
          citations: rec.scenario.citations,
          source: "ask_v3",
        },
      },
    });

    return { id: saved.id };
  });
