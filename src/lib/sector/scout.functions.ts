// @domain sector
// @tables sector_shortlists,sectors
// @ui src/routes/_authenticated/admin/countries.$code.sector.tsx
//
// The Scout: one model call over a profile of every sector in the country's
// corpus, returning a recommend / consider / hold call, a score and a short
// brief per sector. Advisory — the Head of Government chooses the priority
// sectors (sector_priorities); the Scout only informs that choice.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError } from "@/lib/syndication/db";

const SYSTEM = `You are the Scout in GDPVision's Sector Studio. You help a Caribbean Head of Government choose two to four priority sectors to develop over the next decade.

Rules:
- Use ONLY the context lines. Never invent a figure. The method lines describe other nations' experience — use them to reason, never as this country's data.
- Judge each sector on: its current size and trend, the strength of the evidence, its links to other sectors, the country's assets and approved investment, its exposure to modelled threats, and how far a focused plan could move it in ten years.
- "recommend" at most four sectors; "consider" for credible alternatives; "hold" for the rest. Weak evidence lowers the score and must be said.
- score is 0 to 100. headline is one sentence. brief_md is 80 to 160 words of markdown: why, what would have to be true, and the biggest unknown.
- Cite the context keys you relied on (for example scout.tourism, kpi.gdp_growth, summary.economy).
- British/Caribbean spelling. No promotional language.`;

const ScoutSchema = z.object({
  sectors: z.array(
    z.object({
      sector_code: z.string(),
      recommendation: z.enum(["recommend", "consider", "hold"]),
      score: z.number(),
      headline: z.string(),
      brief_md: z.string(),
      citations: z.array(z.object({ key: z.string(), why: z.string() })),
    }),
  ),
});

export const runScout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ sectors: number; recommended: string[]; model: string }> => {
      const { generateStructured, requireGatewayKey } = await import("./model.server");
      requireGatewayKey();
      const { buildScoutPack } = await import("./context.server");
      const pack = await buildScoutPack(context.supabase, data.code);
      if (!pack.sectors.length) throw new Error("No sectors are defined.");

      const prompt = `CONTEXT (key | text | source). These are the only facts you may use.
${pack.lines.map((l) => `${l.key} | ${l.text} | ${l.source.label}`).join("\n")}

Assess every one of these sectors, using its code exactly: ${pack.sectors.map((s) => s.code).join(", ")}.
Return sectors: one entry per sector code.`;

      const { out, model } = await generateStructured({
        schema: ScoutSchema,
        system: SYSTEM,
        prompt,
        tag: "sector-scout",
        maxOutputTokens: 16000,
      });

      const known = new Map(pack.lines.map((l) => [l.key, l]));
      const codes = new Set(pack.sectors.map((s) => s.code));
      const now = new Date().toISOString();
      // Keep the model's order of preference, but never more than four "recommend".
      let recommends = 0;
      const rows = out.sectors
        .filter((s) => codes.has(s.sector_code))
        .sort((a, b) => b.score - a.score)
        .map((s) => {
          let rec = s.recommendation;
          if (rec === "recommend" && ++recommends > 4) rec = "consider";
          return {
            country_code: data.code,
            sector_code: s.sector_code,
            recommendation: rec,
            score: Math.max(0, Math.min(100, Math.round(Number(s.score) || 0))),
            headline: s.headline.trim().slice(0, 400),
            brief_md: s.brief_md.trim().slice(0, 4000),
            citations: s.citations
              .filter((x) => known.has(x.key))
              .slice(0, 12)
              .map((x) => ({
                key: x.key,
                label: known.get(x.key)!.source.label,
                ref: known.get(x.key)!.source.ref,
                why: x.why.slice(0, 200),
              })),
            context_hash: pack.hash,
            model,
            generated_by: context.userId,
            generated_at: now,
          };
        });
      if (!rows.length)
        throw new Error("The Scout returned no usable assessment. Please try again.");

      const { error } = await db(context.supabase)
        .from("sector_shortlists")
        .upsert(rows, { onConflict: "country_code,sector_code" });
      if (error) throw governanceError(error);
      return {
        sectors: rows.length,
        recommended: rows.filter((r) => r.recommendation === "recommend").map((r) => r.sector_code),
        model,
      };
    },
  );
