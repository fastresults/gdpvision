// Counsel — text/voice-adjacent RAG assistant over the Second Brain + Ledger.
// Retrieval is currently keyword/weight-ranked; embeddings backfill lands with the harvest pipeline.
// Memory reads route through corpusRead() so a sparse corpus automatically
// triggers an external deep-search + write-back (see .lovable/plan.md).

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createHash } from "crypto";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { corpusRead } from "@/lib/corpus/gateway.server";
import { searchMemory } from "@/lib/corpus/searchers/memory.server";
import { upsertMemoryObjects, type MemoryObjectInput } from "@/lib/corpus/writers.server";

const AskInput = z.object({
  scopeKey: z.string().min(3).max(16),
  question: z.string().min(1).max(2000),
  sectorHint: z.string().optional(),
});

export interface CounselCitation {
  id: string;
  title: string;
  kind: string;
  sector_code: string;
  weight: number;
}

export interface CounselResearchSource {
  url: string;
  title: string;
  publisher?: string;
}

export interface CounselAnswer {
  id: string;
  spoken_block: string;
  written_block: string;
  citations: CounselCitation[];
  scenario_snapshot: { model_version: string; horizon_years: number; gdp_p50_year1?: number } | null;
  evidence_state: "sufficient" | "insufficient";
  evidence_reason?: string;
  research_sources: CounselResearchSource[];
  parent_answer_id?: string | null;
  used_deep_research: boolean;
}

function tokenize(s: string) {
  return Array.from(new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []));
}

export const askCounsel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AskInput.parse(data))
  .handler(async ({ data, context }): Promise<CounselAnswer> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Counsel unavailable — missing gateway credentials.");

    // 0. Rate limits + provider budget cap (Wave D2). Read caps from
    // instance_config; fall back to conservative defaults if absent.
    const { data: cfgRow } = await context.supabase
      .from("instance_config")
      .select("value_json")
      .eq("key", "counsel.limits")
      .maybeSingle();
    const limits = ((cfgRow?.value_json as { perUserPerHour?: number; perScopePerDay?: number } | null) ?? {});
    const perUserPerHour = limits.perUserPerHour ?? 30;
    const perScopePerDay = limits.perScopePerDay ?? 500;

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: userCount }, { count: scopeCount }] = await Promise.all([
      context.supabase
        .from("counsel_answers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", hourAgo),
      context.supabase
        .from("counsel_answers")
        .select("id", { count: "exact", head: true })
        .eq("scope_key", data.scopeKey)
        .gte("created_at", dayAgo),
    ]);
    if ((userCount ?? 0) >= perUserPerHour) {
      throw new Error(`Counsel rate limit — max ${perUserPerHour} questions per hour per user.`);
    }
    if ((scopeCount ?? 0) >= perScopePerDay) {
      throw new Error(`Counsel budget cap — scope ${data.scopeKey} exceeded ${perScopePerDay} answers today.`);
    }



    // 1. Retrieval — pull weighted memory objects for the scope; drop suppressed sources.
    const { data: suppressions } = await context.supabase
      .from("source_suppressions")
      .select("source_id")
      .eq("scope_key", data.scopeKey)
      .eq("active", true);
    const suppressedIds = new Set((suppressions ?? []).map((s) => s.source_id));

    const readMemory = async () => {
      let q = context.supabase
        .from("memory_objects")
        .select("id,title,kind,sector_code,weight,payload,source_id")
        .in("scope_key", [data.scopeKey, "REGIONAL"])
        .order("weight", { ascending: false })
        .limit(120);
      if (data.sectorHint) q = q.eq("sector_code", data.sectorHint);
      const { data: memoryRaw, error: memErr } = await q;
      if (memErr) throw new Error(memErr.message);
      return (memoryRaw ?? []).filter(
        (m) => !m.source_id || !suppressedIds.has(m.source_id),
      );
    };

    // Corpus-first: if the second brain is thin, corpusRead() triggers the
    // external waterfall (Perplexity → Gemini repair → inference) and writes
    // findings back before returning. The next read then sees the new rows.
    const memoryGateway = await corpusRead<{ rows: MemoryObjectInput[] }>({
      scope: { countryCode: data.scopeKey, sector: data.sectorHint },
      domain: "memory",
      key: data.sectorHint ? `sector:${data.sectorHint}` : "scope:all",
      read: async () => {
        const rows = await readMemory();
        return { rows: rows as unknown as MemoryObjectInput[] };
      },
      isEmpty: (t) => !t || t.rows.length < 3,
      search: async (ctx) => {
        const r = await searchMemory({
          countryCode: ctx.countryCode,
          sector: ctx.sector,
          question: data.question,
        });
        if (!r) return null;
        return {
          data: { rows: r.data.rows },
          citations: r.citations,
          tier: r.tier,
          notes: r.notes,
        };
      },
      writeBack: async (result) => {
        if (result.rows.length) await upsertMemoryObjects(result.rows);
      },
      budget: { maxMs: 25_000 },
      actor: context.userId,
    });

    // Re-query after any external write-back so we surface fresh rows.
    const memory =
      memoryGateway.source === "external" ? await readMemory() : (memoryGateway.data.rows as unknown as Awaited<ReturnType<typeof readMemory>>);
    const memorySliced = memory.slice(0, 80);

    const tokens = tokenize(data.question);
    const scored = memorySliced
      .map((m) => {
        const hay = `${m.title} ${JSON.stringify(m.payload ?? {})}`.toLowerCase();
        const overlap = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { m, score: overlap * 2 + m.weight };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // 2. Pull a scenario snapshot (most recent adopted, then shared, then draft).
    const { data: scenarios } = await context.supabase
      .from("scenarios")
      .select("id,title,status,model_version,horizon_years,results")
      .eq("country_code", data.scopeKey)
      .order("updated_at", { ascending: false })
      .limit(1);
    const scenarioSnap = scenarios?.[0]
      ? {
          model_version: scenarios[0].model_version,
          horizon_years: scenarios[0].horizon_years,
          gdp_p50_year1:
            (scenarios[0].results as { gdp?: Array<{ p50?: number }> } | null)?.gdp?.[0]?.p50,
        }
      : null;

    // 3. Compose grounded prompt.
    const citationLines = scored.map(
      (s, i) => `[${i + 1}] (${s.m.kind}·${s.m.sector_code}·w${s.m.weight}) ${s.m.title}`,
    );
    const system =
      "You are Counsel, a sovereign policy advisor. Answer in two labeled blocks:\n" +
      "SPOKEN: 2–3 sentences a Prime Minister could say aloud, no jargon, no hedging.\n" +
      "WRITTEN: bullet list with numbered citations [n] pointing to the CONTEXT items provided.\n" +
      "Rules: cite only items in CONTEXT; if evidence is missing, say so plainly and do not invent figures.";
    const contextBlock = citationLines.length
      ? `CONTEXT:\n${citationLines.join("\n")}`
      : "CONTEXT: (empty — Second Brain has no matching items)";
    const scenarioBlock = scenarioSnap
      ? `LEDGER SNAPSHOT: model ${scenarioSnap.model_version}, horizon ${scenarioSnap.horizon_years}y, year-1 GDP P50 ${scenarioSnap.gdp_p50_year1 ?? "n/a"}%`
      : "LEDGER SNAPSHOT: (no scenarios in ledger yet)";

    const gateway = createLovableAiGatewayProvider(key);
    let text: string;
    try {
      const result = await generateText({
        model: gateway("openai/gpt-5.5"),
        system,
        prompt: `${contextBlock}\n\n${scenarioBlock}\n\nQUESTION (scope=${data.scopeKey}): ${data.question}`,
      });
      text = result.text;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 429) throw new Error("Counsel rate limit — try again in a moment.");
      if (status === 402) throw new Error("Counsel credits exhausted — top up in workspace billing.");
      throw err;
    }

    const spokenMatch = text.match(/SPOKEN:\s*([\s\S]*?)(?:\n\s*WRITTEN:|$)/i);
    const writtenMatch = text.match(/WRITTEN:\s*([\s\S]*)$/i);
    const spoken = (spokenMatch?.[1] ?? text).trim();
    const written = (writtenMatch?.[1] ?? "").trim();

    const citations: CounselCitation[] = scored.map((s) => ({
      id: s.m.id,
      title: s.m.title,
      kind: s.m.kind,
      sector_code: s.m.sector_code,
      weight: s.m.weight,
    }));

    const hash = createHash("sha256")
      .update(JSON.stringify({ q: data.question, spoken, written, citations, scenarioSnap }))
      .digest("hex");

    const { data: row, error: insErr } = await context.supabase
      .from("counsel_answers")
      .insert({
        scope_key: data.scopeKey,
        user_id: context.userId,
        question: data.question,
        spoken_block: spoken,
        written_block: written,
        citations: citations as unknown as Json,
        tags: (data.sectorHint ? [data.sectorHint] : []) as unknown as Json,
        scenario_snapshot: (scenarioSnap ?? null) as unknown as Json,
        content_hash: hash,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    return {
      id: row.id,
      spoken_block: spoken,
      written_block: written,
      citations,
      scenario_snapshot: scenarioSnap,
    };
  });

export const listCounselArchive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ scopeKey: z.string().min(3).max(16) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("counsel_answers")
      .select("id,question,spoken_block,created_at,tags")
      .eq("scope_key", data.scopeKey)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
