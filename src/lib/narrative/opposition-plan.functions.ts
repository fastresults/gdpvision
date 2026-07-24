// Chamber 05 · Opposition Intel — analyze & plan server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const analyzeOppositionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const {
      extractRawText,
      analyzeMotivation,
      analyzeOrigin,
      fetchBrainContext,
      fetchOppositionPartyNames,
      toJson,
    } = await import("./opposition-analysis.server");

    const { data: row, error } = await context.supabase
      .from("opposition_items")
      .select(
        "id,country_code,kind,storage_path,mime_type,source_url,raw_text",
      )
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Item not found.");

    await context.supabase
      .from("opposition_items")
      .update({ status: "analyzing", status_error: null })
      .eq("id", data.id);

    try {
      const rawText = await extractRawText(context.supabase, row);
      const brainCtx = await fetchBrainContext(context.supabase, row.country_code, rawText.slice(0, 400));
      const motivation = await analyzeMotivation({
        countryCode: row.country_code,
        rawText,
        brainContext: brainCtx,
      });
      const oppositionParties = await fetchOppositionPartyNames(context.supabase, row.country_code);
      const origin = await analyzeOrigin({
        countryCode: row.country_code,
        rawText,
        motivationSummary: motivation.motivation_summary,
        oppositionPartyNames: oppositionParties,
      });

      const combinedCitations = Array.from(
        new Set([...(motivation.citations ?? []), ...(origin.citations ?? [])]),
      ).slice(0, 30);

      await context.supabase
        .from("opposition_items")
        .update({
          status: "analyzed",
          raw_text: rawText.slice(0, 20_000),
          motivation_summary: motivation.motivation_summary,
          origin_summary: origin.origin_summary,
          amplification: toJson(origin.amplification),
          themes: toJson(motivation.themes),
          severity: motivation.severity,
          sentiment: motivation.sentiment,
          confidence_grade: motivation.confidence_grade,
          citations: toJson(combinedCitations),
        })
        .eq("id", data.id);

      // Seed a private memory for the Second Brain
      await context.supabase.from("memory_objects").insert({
        scope_key: row.country_code,
        sector_code: "cross",
        kind: "threat",
        title: `Opposition narrative — ${motivation.themes.slice(0, 2).join(" / ") || "unspecified"}`,
        payload: toJson({
          motivation_summary: motivation.motivation_summary,
          origin_summary: origin.origin_summary,
          amplification: origin.amplification,
          citations: combinedCitations,
        }),
        verified: false,
        visibility: "private",
        owner_country_code: row.country_code,
        uploaded_by: context.userId,
      });

      return { ok: true };
    } catch (err) {
      await context.supabase
        .from("opposition_items")
        .update({ status: "failed", status_error: (err as Error).message.slice(0, 800) })
        .eq("id", data.id);
      throw err;
    }
  });

export const generateOppositionResponsePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { generatePlan, fetchRulingContext, toJson } = await import("./opposition-analysis.server");

    const { data: row, error } = await context.supabase
      .from("opposition_items")
      .select(
        "id,country_code,motivation_summary,origin_summary,themes,severity",
      )
      .eq("id", data.itemId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Item not found.");
    if (!row.motivation_summary) throw new Error("Run analysis before generating a plan.");

    const { rulingLine, pledges } = await fetchRulingContext(context.supabase, row.country_code);

    const themes = Array.isArray(row.themes) ? (row.themes as string[]) : [];
    const plan = await generatePlan({
      countryCode: row.country_code,
      motivationSummary: row.motivation_summary,
      originSummary: row.origin_summary ?? "",
      themes,
      severity: row.severity ?? 3,
      rulingPartyLine: rulingLine,
      manifestoPledges: pledges,
    });

    const { data: saved, error: pErr } = await context.supabase
      .from("opposition_response_plans")
      .upsert(
        {
          item_id: row.id,
          country_code: row.country_code,
          posture: plan.posture,
          objective: plan.objective,
          key_messages: toJson(plan.key_messages),
          audience_segments: toJson(plan.audience_segments),
          channel_plan: toJson(plan.channel_plan),
          sequenced_actions: toJson(plan.sequenced_actions),
          risks: toJson(plan.risks),
          success_metrics: toJson(plan.success_metrics),
          citations: toJson(plan.citations),
          confidence_grade: plan.confidence_grade,
        },
        { onConflict: "item_id" },
      )
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    return { id: saved.id };
  });
