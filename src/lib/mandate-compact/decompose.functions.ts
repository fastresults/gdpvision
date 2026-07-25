// @domain mandate-compact
// @tables mandate_compacts,country_manifestos,country_source_chunks,compact_pillars,compact_pledges
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Decompose — reads the manifesto text from the country's second
// brain and uses Gemini to derive a pillar × pledge tree. Idempotent: wipes
// prior pillars/pledges for this compact (cascade to deliverables) before
// re-inserting. Deliberately deterministic — no ministry assignment happens
// here (that's Transform).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGeminiJson } from "@/lib/country-onboarding/gemini.server";

const Input = z.object({ compactId: z.string().uuid() });

const PILLAR_COLORS = [
  "sector-01",
  "sector-02",
  "sector-03",
  "sector-04",
  "sector-05",
  "sector-06",
  "sector-07",
  "sector-08",
];

type DecomposedPledge = {
  title: string;
  verbatim_quote?: string | null;
  pledge_type?: "quantitative" | "qualitative" | "legislative" | "institutional" | null;
  baseline_value?: number | null;
  target_value?: number | null;
  unit?: string | null;
};

type DecomposedPillar = {
  title: string;
  narrative?: string | null;
  pledges: DecomposedPledge[];
};

type DecomposedShape = { pillars: DecomposedPillar[] };

export type DecomposeResult = {
  compact_id: string;
  pillars_created: number;
  pledges_created: number;
  model: string;
  source_chars: number;
};

const SCHEMA_HINT = `{
  "pillars": [
    {
      "title": "string · 3-6 words, transformational theme",
      "narrative": "string · 1-2 sentences on why this pillar matters for GDP / wellbeing",
      "pledges": [
        {
          "title": "string · concrete commitment, 6-14 words",
          "verbatim_quote": "string · exact quote from the manifesto if available",
          "pledge_type": "quantitative | qualitative | legislative | institutional",
          "baseline_value": "number or null",
          "target_value": "number or null",
          "unit": "string or null (e.g. %, USD m, MW, jobs)"
        }
      ]
    }
  ]
}`;

const SYSTEM =
  "You are a McKinsey-trained sovereign strategy analyst. Decompose a national manifesto into 4-8 transformational pillars, each with 3-10 concrete pledges. Prefer verbatim quotes from the manifesto and extract numeric baselines/targets when present. Never invent numbers.";

async function loadManifestoText(supabase: any, compactId: string): Promise<{ text: string; countryCode: string; manifestoId: string | null }> {
  const { data: compact, error } = await supabase
    .from("mandate_compacts")
    .select("id, country_code, manifesto_id, summary, title")
    .eq("id", compactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!compact) throw new Error("Compact not found");

  let sourceDocumentId: string | null = null;
  if (compact.manifesto_id) {
    const { data: m } = await supabase
      .from("country_manifestos")
      .select("source_document_id")
      .eq("id", compact.manifesto_id)
      .maybeSingle();
    sourceDocumentId = m?.source_document_id ?? null;
  }

  let chunks: { content: string }[] = [];
  if (sourceDocumentId) {
    const { data } = await supabase
      .from("country_source_chunks")
      .select("content, chunk_index")
      .eq("document_id", sourceDocumentId)
      .order("chunk_index");
    chunks = data ?? [];
  }

  const stitched = chunks.map((c) => c.content).join("\n\n").trim();
  const preface = [compact.title, compact.summary].filter(Boolean).join("\n\n");
  const text = [preface, stitched].filter(Boolean).join("\n\n");

  return { text, countryCode: compact.country_code, manifestoId: compact.manifesto_id ?? null };
}

export const decomposeMandateCompact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }): Promise<DecomposeResult> => {
    const { supabase } = context;
    const { text, countryCode } = await loadManifestoText(supabase, data.compactId);
    if (text.trim().length < 200) {
      throw new Error("Manifesto text is too short to decompose. Re-ingest with the full manifesto body.");
    }

    const { parsed, content, model } = await callGeminiJson<DecomposedShape>({
      system: SYSTEM,
      user: `Decompose the manifesto below into pillars and pledges.\n\nMANIFESTO:\n"""\n${text.slice(0, 60_000)}\n"""`,
      schemaHint: SCHEMA_HINT,
    });

    if (!parsed?.pillars?.length) {
      throw new Error(`Decompose failed to return pillars (${model}): ${content.slice(0, 200)}`);
    }

    // Wipe prior pillars/pledges/deliverables for this compact.
    const { error: delErr } = await supabase
      .from("compact_pillars")
      .delete()
      .eq("compact_id", data.compactId);
    if (delErr) throw new Error(`Failed to clear prior pillars: ${delErr.message}`);

    let pillarsCreated = 0;
    let pledgesCreated = 0;

    for (let pi = 0; pi < parsed.pillars.length; pi++) {
      const p = parsed.pillars[pi];
      const { data: pillarRow, error: pErr } = await supabase
        .from("compact_pillars")
        .insert({
          compact_id: data.compactId,
          country_code: countryCode,
          title: p.title,
          narrative: p.narrative ?? null,
          color_token: PILLAR_COLORS[pi % PILLAR_COLORS.length],
          sort_order: (pi + 1) * 10,
        })
        .select("id")
        .single();
      if (pErr || !pillarRow) throw new Error(pErr?.message ?? "pillar insert failed");
      pillarsCreated++;

      const pledgeRows = (p.pledges ?? []).map((pl, idx) => ({
        compact_id: data.compactId,
        pillar_id: pillarRow.id,
        country_code: countryCode,
        title: pl.title,
        verbatim_quote: pl.verbatim_quote ?? null,
        pledge_type: pl.pledge_type ?? null,
        baseline_value: typeof pl.baseline_value === "number" ? pl.baseline_value : null,
        target_value: typeof pl.target_value === "number" ? pl.target_value : null,
        unit: pl.unit ?? null,
        sort_order: (idx + 1) * 10,
      }));
      if (pledgeRows.length) {
        const { error: plErr } = await supabase.from("compact_pledges").insert(pledgeRows);
        if (plErr) throw new Error(`Pledge insert failed: ${plErr.message}`);
        pledgesCreated += pledgeRows.length;
      }
    }

    return {
      compact_id: data.compactId,
      pillars_created: pillarsCreated,
      pledges_created: pledgesCreated,
      model,
      source_chars: text.length,
    };
  });
