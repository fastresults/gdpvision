// Executive-summary generation for onboarding stages.
// Reads the committed draft payload for a (country, stage), asks Lovable AI
// to write a short elegant briefing + a few key highlights, and upserts into
// public.onboarding_summaries.

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAGES = [
  "profile",
  "gdp",
  "sector_composition",
  "ministries",
  "ministry_sector_map",
  "source_registry",
  "kpi_seed",
  "sector_dossier",
  "ministry_deep_dive",
  "corpus_ingest",
  "second_brain_seed",
] as const;
export type SummaryStage = (typeof STAGES)[number];

const STAGE_LABEL: Record<SummaryStage, string> = {
  profile: "Country profile",
  gdp: "GDP",
  sector_composition: "Sector composition",
  ministries: "Cabinet ministries",
  ministry_sector_map: "Ministry × sector map",
  source_registry: "Source registry",
  kpi_seed: "KPI seed",
  sector_dossier: "Sector dossiers",
  ministry_deep_dive: "Ministry deep-dive",
  corpus_ingest: "Corpus ingest",
  second_brain_seed: "Second-brain seed",
};

const STAGE_GUIDANCE: Record<SummaryStage, string> = {
  profile:
    "One tight paragraph naming the currency, fiscal year start month, population, and head of government, with a sentence on the country's economic character. Highlights: currency, fiscal year start, population, head of government, HDI if present.",
  gdp:
    "Explain the nominal GDP in USD for the latest year, note the WB/IMF cross-check, and situate the number in scale. Highlights: nominal GDP USD, year, per-capita if derivable.",
  sector_composition:
    "Describe where output is concentrated in one paragraph, naming the top 2–3 sectors and their share. Highlights: top 3 sectors by share_pct.",
  ministries:
    "Sketch the shape of the cabinet — how many ministries, notable portfolios, any consolidations. Highlights: ministry count, 3–5 notable portfolios.",
  ministry_sector_map:
    "Explain how portfolios map onto the economy — which ministries carry the most weight across sectors. Highlights: densest ministries by total weight.",
  source_registry:
    "Describe the evidence base by tier (government, regional, multilateral, media) and note the strongest anchors. Highlights: counts by tier and total sources.",
  kpi_seed:
    "Give the macro / fiscal / social pulse in one paragraph, naming a few headline KPIs with latest values. Highlights: 4–6 KPIs with latest_value and unit.",
  sector_dossier:
    "Describe the narrative posture per sector and the regional benchmarks used. Highlights: dossier count, benchmarked peers.",
  ministry_deep_dive:
    "Describe minister-level readiness — profiled ministers, flagship programmes. Highlights: profiled ministries and flagship programme count.",
  corpus_ingest:
    "Describe retrieval readiness — how many chunks embedded across how many sources. Highlights: chunk count, document count, source count.",
  second_brain_seed:
    "Describe the cabinet-ready memory — positions, audiences, outlets, facts, risks. Highlights: counts by object kind.",
};

const SYSTEM_PROMPT = [
  "You are a cabinet-grade briefing writer for a sovereign advisory system.",
  "Write with confident, plain English — no jargon, no hedging, no filler.",
  "Return STRICT JSON matching this shape and nothing else:",
  '{ "summary_md": string, "highlights": [{ "label": string, "value": string }] }',
  "summary_md must be 2 to 4 sentences (max ~90 words), written in flowing prose.",
  "highlights must contain 3 to 6 short key facts, each with a concise label and a compact value.",
  "Never invent facts that are not in the provided PAYLOAD. If a field is missing, omit it.",
].join("\n");

async function loadLatestCommittedDraft(admin: any, countryCode: string, stage: SummaryStage) {
  const { data } = await admin
    .from("onboarding_drafts")
    .select("id, run_id, stage, payload, created_at, committed_at")
    .eq("country_code", countryCode)
    .eq("stage", stage)
    .not("committed_at", "is", null)
    .order("committed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function loadCountryContext(admin: any, code: string) {
  const { data } = await admin
    .from("countries")
    .select("code, name, iso3, currency, fiscal_year_start_month")
    .eq("code", code)
    .maybeSingle();
  return data;
}

function clamp<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}

function truncatePayload(payload: unknown, maxChars = 12_000): string {
  const s = JSON.stringify(payload ?? {}, null, 2);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + `\n… (truncated ${s.length - maxChars} chars)`;
}

type SummaryResult = {
  summary_md: string;
  highlights: Array<{ label: string; value: string }>;
  model: string;
};

async function writeSummary(args: {
  countryCode: string;
  countryName: string | null;
  stage: SummaryStage;
  payload: unknown;
}): Promise<SummaryResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);

  const model = "openai/gpt-5.5";
  const stageLabel = STAGE_LABEL[args.stage];
  const guidance = STAGE_GUIDANCE[args.stage];
  const context = `COUNTRY: ${args.countryName ?? args.countryCode} (${args.countryCode})`;
  const payloadBlock = `PAYLOAD (committed data for stage "${stageLabel}"):\n${truncatePayload(args.payload)}`;
  const prompt = `${context}\n\nSTAGE: ${stageLabel}\nGUIDANCE: ${guidance}\n\n${payloadBlock}\n\nReturn only the JSON object.`;

  let text: string;
  try {
    const result = await generateText({
      model: gateway(model),
      system: SYSTEM_PROMPT,
      prompt,
    });
    text = result.text ?? "";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) throw new Error("Rate limit — try again shortly.");
    if (status === 402) throw new Error("Lovable AI credits exhausted — top up in workspace billing.");
    throw err;
  }

  const parsed = parseSummaryJson(text);
  const summary_md = String(parsed.summary_md ?? "").trim().slice(0, 900);
  const highlights = clamp(
    Array.isArray(parsed.highlights)
      ? parsed.highlights
          .filter((h: any) => h && typeof h.label === "string" && typeof h.value !== "undefined")
          .map((h: any) => ({ label: String(h.label).slice(0, 60), value: String(h.value).slice(0, 200) }))
      : [],
    6,
  );

  if (!summary_md) {
    throw new Error("Summary generation returned empty output.");
  }

  return { summary_md, highlights, model };
}

function parseSummaryJson(text: string): { summary_md?: unknown; highlights?: unknown } {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to extract the first {...} block.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    return {};
  }
}

async function upsertSummary(
  admin: any,
  args: { countryCode: string; stage: SummaryStage; sourceRunId?: string | null; result: SummaryResult },
) {
  await admin
    .from("onboarding_summaries")
    .upsert(
      {
        country_code: args.countryCode,
        stage: args.stage,
        summary_md: args.result.summary_md,
        highlights: args.result.highlights,
        model: args.result.model,
        source_run_id: args.sourceRunId ?? null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "country_code,stage" },
    );
}

/**
 * Server-side helper — call from a commit handler, fire-and-forget:
 *   generateSummaryForStage(supabaseAdmin, code, stage, runId).catch(console.error);
 * Loads the latest committed draft for that (country, stage) and writes to onboarding_summaries.
 */
export async function generateSummaryForStage(
  admin: any,
  countryCode: string,
  stage: SummaryStage,
  sourceRunId?: string | null,
): Promise<SummaryResult | null> {
  const [draft, country] = await Promise.all([
    loadLatestCommittedDraft(admin, countryCode, stage),
    loadCountryContext(admin, countryCode),
  ]);
  if (!draft) return null;
  const result = await writeSummary({
    countryCode,
    countryName: country?.name ?? null,
    stage,
    payload: draft.payload,
  });
  await upsertSummary(admin, { countryCode, stage, sourceRunId: sourceRunId ?? draft.run_id ?? null, result });
  return result;
}

// ============================================================
// Server functions callable from the admin UI
// ============================================================

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

const StageInput = z.object({
  countryCode: z.string(),
  stage: z.enum(STAGES),
});

export const generateStageSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StageInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await generateSummaryForStage(supabaseAdmin, data.countryCode, data.stage);
    if (!result) throw new Error("No committed draft found for this stage yet.");
    return { ok: true, ...result };
  });

export const listStageSummaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("onboarding_summaries")
      .select("*")
      .eq("country_code", data.countryCode);
    if (error) throw error;
    return rows ?? [];
  });
