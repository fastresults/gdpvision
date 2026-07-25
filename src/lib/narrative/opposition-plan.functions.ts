// @domain narrative
// @tables comms_artifacts,memory_objects,opposition_items,opposition_response_plans
// @ui src/components/narrative/opposition/CounterCampaignPanel.tsx; src/components/narrative/opposition/OppositionDetail.tsx; src/components/narrative/opposition/OppositionIntakeDropZone.tsx

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
        "id,country_code,kind,storage_path,mime_type,source_url,raw_text,submitter_context",
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
      const submitterContext = (row.submitter_context ?? "").trim() || undefined;
      const brainCtx = await fetchBrainContext(context.supabase, row.country_code, `${submitterContext ?? ""} ${rawText.slice(0, 400)}`);
      const motivation = await analyzeMotivation({
        countryCode: row.country_code,
        rawText,
        brainContext: brainCtx,
        submitterContext,
      });
      const oppositionParties = await fetchOppositionPartyNames(context.supabase, row.country_code);
      const origin = await analyzeOrigin({
        countryCode: row.country_code,
        rawText,
        motivationSummary: motivation.motivation_summary,
        oppositionPartyNames: oppositionParties,
        submitterContext,
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
        "id,country_code,motivation_summary,origin_summary,themes,severity,submitter_context",
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
      submitterContext: (row.submitter_context ?? "").trim() || undefined,
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

// ─── Publish the plan to the Comms Library as a draft ────────────────────

function firstChannelKind(channel: string | undefined): "press_release" | "op_ed" | "briefing" | "speech" | "social" | "memo" {
  const c = (channel ?? "").toLowerCase();
  if (/whatsapp|sms|telegram|tiktok|x|twitter|facebook|instagram|social/.test(c)) return "social";
  if (/press|newswire|release/.test(c)) return "press_release";
  if (/op[-\s]?ed|opinion/.test(c)) return "op_ed";
  if (/speech|address|remarks/.test(c)) return "speech";
  if (/brief/.test(c)) return "briefing";
  return "memo";
}

function renderPlanMarkdown(plan: {
  posture: string | null;
  objective: string | null;
  key_messages: unknown;
  audience_segments: unknown;
  channel_plan: unknown;
  sequenced_actions: unknown;
  risks: unknown;
  success_metrics: unknown;
  citations: unknown;
}, itemTitle: string) {
  const km = Array.isArray(plan.key_messages) ? (plan.key_messages as Array<{ audience?: string; message: string }>) : [];
  const cp = Array.isArray(plan.channel_plan) ? (plan.channel_plan as Array<{ channel: string; cadence?: string; artifact_kind: string }>) : [];
  const sa = Array.isArray(plan.sequenced_actions) ? (plan.sequenced_actions as Array<{ when: string; action: string; owner?: string }>) : [];
  const risks = Array.isArray(plan.risks) ? (plan.risks as string[]) : [];
  const metrics = Array.isArray(plan.success_metrics) ? (plan.success_metrics as string[]) : [];
  const aud = Array.isArray(plan.audience_segments) ? (plan.audience_segments as string[]) : [];
  const cites = Array.isArray(plan.citations) ? (plan.citations as string[]) : [];

  const lines: string[] = [];
  lines.push(`# Counter-campaign — ${itemTitle}`);
  if (plan.posture) lines.push(`**Posture:** ${plan.posture}`);
  if (plan.objective) lines.push(`\n${plan.objective}\n`);
  if (aud.length) lines.push(`**Audiences:** ${aud.join(" · ")}`);
  if (km.length) {
    lines.push(`\n## Key messages`);
    for (const m of km) lines.push(`- ${m.audience ? `**[${m.audience}]** ` : ""}${m.message}`);
  }
  if (sa.length) {
    lines.push(`\n## Sequenced actions`);
    for (const a of sa) lines.push(`- **${a.when}** — ${a.action}${a.owner ? ` _(${a.owner})_` : ""}`);
  }
  if (cp.length) {
    lines.push(`\n## Channel plan`);
    lines.push(`| Channel | Cadence | Artifact |`);
    lines.push(`| --- | --- | --- |`);
    for (const c of cp) lines.push(`| ${c.channel} | ${c.cadence ?? "—"} | ${c.artifact_kind} |`);
  }
  if (risks.length) {
    lines.push(`\n## Risks`);
    for (const r of risks) lines.push(`- ${r}`);
  }
  if (metrics.length) {
    lines.push(`\n## Success metrics`);
    for (const r of metrics) lines.push(`- ${r}`);
  }
  if (cites.length) {
    lines.push(`\n## Sources`);
    cites.slice(0, 20).forEach((u, i) => lines.push(`${i + 1}. ${u}`));
  }
  return lines.join("\n");
}

export const publishOppositionPlanToComms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: item, error: iErr } = await context.supabase
      .from("opposition_items")
      .select("id,country_code,title")
      .eq("id", data.itemId)
      .single();
    if (iErr || !item) throw new Error(iErr?.message ?? "Intake not found.");

    const { data: plan, error: pErr } = await context.supabase
      .from("opposition_response_plans")
      .select("posture,objective,key_messages,audience_segments,channel_plan,sequenced_actions,risks,success_metrics,citations")
      .eq("item_id", data.itemId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!plan) throw new Error("Draft a counter-campaign first.");

    const cp = Array.isArray(plan.channel_plan) ? (plan.channel_plan as Array<{ channel: string; cadence?: string; artifact_kind: string }>) : [];
    const aud = Array.isArray(plan.audience_segments) ? (plan.audience_segments as string[]) : [];
    const primaryChannel = cp[0]?.channel ?? "cross-channel";
    const kind = firstChannelKind(primaryChannel);
    const audience = aud[0] ?? "General public";
    const body = renderPlanMarkdown(plan as never, item.title ?? "Opposition intake");

    const { data: row, error: cErr } = await context.supabase
      .from("comms_artifacts")
      .insert({
        scope_key: item.country_code,
        strategy_id: null,
        kind,
        audience,
        channel: primaryChannel,
        body,
        draft_state: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    return { id: row.id as string };
  });
