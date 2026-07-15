// Ledger-QA AI Diagnose fallback.
// When the registry has no wired remediator for a WARN/FAIL, ask Lovable AI
// to synthesise a diagnosis from live corpus-attempt logs + table row-counts.
// Result is cached 10min per (check_key, cc) inside the process.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const Input = z.object({
  countryCode: z.string().length(3),
  checkKey: z.string().min(1).max(64),
  verdictDetail: z.string().max(2000).optional(),
});

export type Diagnosis = {
  root_cause: string;
  class: "data-missing" | "data-quality" | "code-defect" | "external-outage" | "config";
  remediator_key: string | null;
  operator_steps: string[];
  confidence: "low" | "med" | "high";
};

type CacheEntry = { at: number; value: Diagnosis };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60_000;

const CHECK_TABLES: Record<string, string[]> = {
  overview: ["country_sectors", "ministries"],
  enrichment: ["country_capital_flows", "capital_flow_nodes"],
  trust: ["country_kpis", "country_kpi_points"],
  sources: ["country_sources", "source_health_checks"],
  gate: ["sector_dossiers", "series_freshness", "grade_alerts"],
  recon: ["country_sectors", "country_capital_flows"],
  "corpus-miss": ["corpus_fetch_attempts"],
  explain: ["country_source_chunks"],
  ask: ["country_source_chunks"],
  "ask-refuse": ["country_source_chunks"],
  "snapshot-rt": ["figure_snapshots"],
  handoff: ["intake_items"],
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — super admin only");
}

export const diagnoseFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<Diagnosis> => {
    await assertAdmin(context);
    const cacheKey = `${data.checkKey}|${data.countryCode}`;
    const hit = CACHE.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const { supabase } = context;

    // Load recent corpus attempts (any domain) for this country.
    const { data: attempts } = await supabase
      .from("corpus_fetch_attempts")
      .select("domain,key,outcome,tier,latency_ms,error,created_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(25);

    // Row-counts for likely-touched tables.
    const tables = CHECK_TABLES[data.checkKey] ?? [];
    const counts: Array<{ table: string; count: number | null }> = [];
    for (const t of tables) {
      const { count } = await supabase
        .from(t as never)
        .select("*", { head: true, count: "exact" })
        .eq("country_code", data.countryCode as never);
      counts.push({ table: t, count: count ?? null });
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const system =
      "You are a systems diagnostician for a data-ingestion platform. Given a failing QA check, live corpus fetch logs, and table row counts, output STRICT JSON matching this TypeScript type:\n" +
      `{"root_cause": string, "class": "data-missing"|"data-quality"|"code-defect"|"external-outage"|"config", "remediator_key": string|null, "operator_steps": string[], "confidence": "low"|"med"|"high"}\n` +
      "Valid remediator_key values: backfillCapitalFlows, backfillSectors, backfillMinistryProfiles, backfillKpiSeries, repairInvalidSourceUrls, retryUnreachableSources, redriveCorpusMisses, cascadeFix, or null.\n" +
      "Be concise. No prose outside JSON.";

    const prompt = [
      `check_key: ${data.checkKey}`,
      `country_code: ${data.countryCode}`,
      `verdict: ${data.verdictDetail ?? "(none)"}`,
      `table_counts: ${JSON.stringify(counts)}`,
      `recent_corpus_attempts: ${JSON.stringify(attempts ?? [])}`,
      "Return JSON only.",
    ].join("\n");

    let text = "";
    try {
      const r = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt,
      });
      text = (r.text ?? "").trim();
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 429) throw new Error("AI Diagnose rate-limited — try again shortly.");
      if (status === 402) throw new Error("Lovable AI credits exhausted.");
      throw err;
    }

    // Strip fenced code block if present.
    const clean = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: Diagnosis;
    try {
      parsed = JSON.parse(clean) as Diagnosis;
    } catch {
      throw new Error(`AI returned non-JSON: ${clean.slice(0, 160)}`);
    }
    CACHE.set(cacheKey, { at: Date.now(), value: parsed });
    return parsed;
  });
