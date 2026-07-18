// Chamber 05 — Narrative Chamber: country-scoped signal → statement pipeline.
// Adds AI-grounded ingestion, triage recommendation, strategy drafting,
// channel drafting, publish + coverage — layered on top of the existing
// narrative.functions.ts (intake_items, strategy_statements, comms_artifacts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SignalScope = "local" | "regional" | "international";
export type SignalRecommendation = "lead" | "amplify" | "counter" | "monitor" | "ignore";

export interface SignalRow {
  id: string;
  scope_key: string;
  sector_code: string;
  topic: string;
  summary: string | null;
  url: string | null;
  proposed_weight: number;
  final_weight: number | null;
  state: string;
  scope: SignalScope | null;
  severity: number | null;
  reach: number | null;
  sentiment: number | null;
  recommendation: SignalRecommendation | null;
  metadata: Json;
  created_at: string;
}

// ─── List / Get ──────────────────────────────────────────────────────────────

export const listSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      countryCode: z.string().min(2).max(16),
      state: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SignalRow[]> => {
    let q = context.supabase
      .from("intake_items")
      .select(
        "id,scope_key,sector_code,topic,summary,url,proposed_weight,final_weight,state,scope,severity,reach,sentiment,recommendation,metadata,created_at",
      )
      .eq("scope_key", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.state) q = q.eq("state", data.state);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as SignalRow[];
  });

export const getSignal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<SignalRow> => {
    const { data: row, error } = await context.supabase
      .from("intake_items")
      .select(
        "id,scope_key,sector_code,topic,summary,url,proposed_weight,final_weight,state,scope,severity,reach,sentiment,recommendation,metadata,created_at",
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as SignalRow;
  });

// ─── Ingest / classify from a URL or free-text ──────────────────────────────

const IngestInput = z.object({
  countryCode: z.string().min(2).max(16),
  url: z.string().url().optional(),
  raw: z.string().max(6000).optional(),
  hintSectorCode: z.string().optional(),
});

type Classification = {
  scope: SignalScope;
  sector_code: string;
  severity: number;
  reach: number;
  sentiment: number;
  topic: string;
  summary: string;
  dossier_bullets: string[];
  recommendation: SignalRecommendation;
  rationale: string;
};

async function classifyWithPerplexity(input: {
  countryCode: string;
  url?: string;
  raw?: string;
  hintSectorCode?: string;
  sectorMenu: string[];
}): Promise<Classification> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");

  const userPrompt = [
    `Country: ${input.countryCode}`,
    input.url ? `URL: ${input.url}` : "",
    input.raw ? `Raw signal:\n${input.raw}` : "",
    `Available sector codes: ${input.sectorMenu.join(", ") || "cross"}`,
    input.hintSectorCode ? `User hint sector_code: ${input.hintSectorCode}` : "",
    "",
    "Task: Read the URL (or raw text). Return a JSON object matching the schema.",
    "- scope: local|regional|international (relative to this country).",
    "- sector_code: pick the single best code from the available list; use 'cross' if none fit.",
    "- severity 1-5, reach 1-5, sentiment -2..+2 (negative → adverse to the country's interests).",
    "- topic: ≤ 90 chars headline for a PM's morning brief.",
    "- summary: 2 sentences.",
    "- dossier_bullets: 4 crisp bullets — what happened, why now, who's affected, likely blowback.",
    "- recommendation: lead | amplify | counter | monitor | ignore (McKinsey framing).",
    "- rationale: 1 sentence justifying the recommendation.",
  ].filter(Boolean).join("\n");

  const schema = {
    type: "object",
    properties: {
      scope: { type: "string" },
      sector_code: { type: "string" },
      severity: { type: "number" },
      reach: { type: "number" },
      sentiment: { type: "number" },
      topic: { type: "string" },
      summary: { type: "string" },
      dossier_bullets: { type: "array", items: { type: "string" } },
      recommendation: { type: "string" },
      rationale: { type: "string" },
    },
    required: ["scope", "sector_code", "severity", "reach", "sentiment", "topic", "summary", "dossier_bullets", "recommendation", "rationale"],
  };

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "You are a McKinsey-grade GDP-sector narrative analyst. Return strict JSON, no prose." },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: "signal_classification", schema } },
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && body.includes("insufficient_quota")) {
      throw new Error("Perplexity API credits exhausted. Buy credits at https://console.perplexity.ai.");
    }
    throw new Error(`Perplexity classify failed [${res.status}]: ${body}`);
  }
  const j = await res.json();
  const content: string = j?.choices?.[0]?.message?.content ?? "";
  const citations: string[] = Array.isArray(j?.citations) ? j.citations : [];
  let parsed: Classification;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Classifier returned no JSON.");
    parsed = JSON.parse(m[0]);
  }
  (parsed as unknown as { citations?: string[] }).citations = citations;
  return parsed;
}

export const ingestSignalFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IngestInput.parse(data))
  .handler(async ({ data, context }) => {
    if (!data.url && !data.raw) throw new Error("Provide a URL or raw text.");

    const { data: sectors } = await context.supabase
      .from("country_sectors")
      .select("sector_code")
      .eq("country_code", data.countryCode);
    const sectorMenu = (sectors ?? []).map((r) => r.sector_code as string);

    const c = await classifyWithPerplexity({
      countryCode: data.countryCode,
      url: data.url,
      raw: data.raw,
      hintSectorCode: data.hintSectorCode,
      sectorMenu,
    });

    const cits = (c as unknown as { citations?: string[] }).citations ?? [];

    const { data: row, error } = await context.supabase
      .from("intake_items")
      .insert({
        scope_key: data.countryCode,
        sector_code: c.sector_code || "cross",
        topic: c.topic.slice(0, 240),
        summary: c.summary,
        url: data.url ?? null,
        proposed_weight: Math.max(1, Math.min(5, Math.round((c.severity + c.reach) / 2))),
        scope: c.scope,
        severity: Math.max(1, Math.min(5, c.severity)),
        reach: Math.max(1, Math.min(5, c.reach)),
        sentiment: Math.max(-2, Math.min(2, c.sentiment)),
        recommendation: c.recommendation,
        metadata: {
          dossier_bullets: c.dossier_bullets,
          rationale: c.rationale,
          citations: cits,
          ingested_at: new Date().toISOString(),
        } as unknown as Json,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ─── Deep-research redrive (enrich an existing signal) ──────────────────────

export const redriveSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("intake_items")
      .select("id,scope_key,sector_code,topic,summary,url")
      .eq("id", data.id)
      .single();
    if (!row) throw new Error("Signal not found.");

    const { data: sectors } = await context.supabase
      .from("country_sectors")
      .select("sector_code")
      .eq("country_code", row.scope_key);
    const sectorMenu = (sectors ?? []).map((r) => r.sector_code as string);

    const c = await classifyWithPerplexity({
      countryCode: row.scope_key,
      url: row.url ?? undefined,
      raw: `${row.topic}\n\n${row.summary ?? ""}`,
      hintSectorCode: row.sector_code,
      sectorMenu,
    });
    const cits = (c as unknown as { citations?: string[] }).citations ?? [];

    const { error } = await context.supabase
      .from("intake_items")
      .update({
        topic: c.topic.slice(0, 240),
        summary: c.summary,
        scope: c.scope,
        severity: c.severity,
        reach: c.reach,
        sentiment: c.sentiment,
        recommendation: c.recommendation,
        sector_code: c.sector_code || row.sector_code,
        metadata: {
          dossier_bullets: c.dossier_bullets,
          rationale: c.rationale,
          citations: cits,
          redriven_at: new Date().toISOString(),
        } as unknown as Json,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Strategy draft (7-part, grounded) ──────────────────────────────────────

export const generateStrategyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ signalId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: sig } = await context.supabase
      .from("intake_items")
      .select("scope_key,sector_code,topic,summary,url,recommendation,metadata")
      .eq("id", data.signalId)
      .single();
    if (!sig) throw new Error("Signal not found.");

    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) throw new Error("PERPLEXITY_API_KEY not configured");

    const prompt = [
      `Country: ${sig.scope_key} · Sector: ${sig.sector_code}`,
      `Signal: ${sig.topic}`,
      `Summary: ${sig.summary ?? ""}`,
      sig.url ? `Source URL: ${sig.url}` : "",
      `Recommended posture: ${sig.recommendation ?? "monitor"}`,
      "",
      "Draft a McKinsey Pyramid / SCQA 7-part strategy statement for the PM's press office.",
      "Every claim must be grounded in the country's actual economy — cite web sources.",
      "Keep each field 1-3 tight sentences. Return JSON only.",
    ].filter(Boolean).join("\n");

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        situation: { type: "string" },
        complication: { type: "string" },
        question: { type: "string" },
        answer: { type: "string" },
        grounds: { type: "string" },
        warrant: { type: "string" },
        call: { type: "string" },
        talking_points: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
      },
      required: ["title", "situation", "complication", "question", "answer", "grounds", "warrant", "call", "talking_points", "risks"],
    };

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-reasoning-pro",
        messages: [
          { role: "system", content: "You are the Prime Minister's chief communications strategist. McKinsey tone. Return strict JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "strategy_seven_part", schema } },
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 && body.includes("insufficient_quota")) {
        throw new Error("Perplexity API credits exhausted. Buy credits at https://console.perplexity.ai.");
      }
      throw new Error(`Perplexity strategy failed [${res.status}]: ${body}`);
    }
    const j = await res.json();
    const content: string = j?.choices?.[0]?.message?.content ?? "";
    const citations: string[] = Array.isArray(j?.citations) ? j.citations : [];
    let parsed: {
      title: string;
      situation: string; complication: string; question: string; answer: string;
      grounds: string; warrant: string; call: string;
      talking_points: string[]; risks: string[];
    };
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Strategy model returned no JSON.");
      parsed = JSON.parse(m[0]);
    }

    const { data: row, error } = await context.supabase
      .from("strategy_statements")
      .insert({
        scope_key: sig.scope_key,
        sector_code: sig.sector_code,
        title: parsed.title.slice(0, 240),
        seven_part: {
          situation: parsed.situation, complication: parsed.complication,
          question: parsed.question, answer: parsed.answer, grounds: parsed.grounds,
          warrant: parsed.warrant, call: parsed.call,
          talking_points: parsed.talking_points, risks: parsed.risks,
        } as unknown as Json,
        sources: citations.map((u, i) => ({ label: `Source ${i + 1}`, ref: u })) as unknown as Json,
        status: "draft",
        version: 1,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // lineage
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("narrative_lineage").insert({
      signal_id: data.signalId,
      artifact_type: "strategy",
      artifact_id: row.id,
      scope_key: sig.scope_key,
      sector_code: sig.sector_code,
      created_by: context.userId,
    });

    await context.supabase
      .from("intake_items")
      .update({ state: "accepted" })
      .eq("id", data.signalId);

    return { id: row.id };
  });

// ─── Channel draft (press release, X, PM statement, memo, radio, op-ed) ────

const CHANNEL_SPECS: Record<string, { kind: string; audience: string; instructions: string; }> = {
  press_release: { kind: "press_release", audience: "National + international media", instructions: "One-page press release, dateline, quote from PM, boilerplate." },
  pm_statement: { kind: "speech", audience: "General public", instructions: "PM's spoken statement, ≤ 240 words, first-person, calm and confident." },
  x_thread: { kind: "social", audience: "Digital-native public", instructions: "Numbered thread of 5 posts, each ≤ 260 chars, plain text." },
  linkedin: { kind: "social", audience: "Investors + regional leaders", instructions: "Single LinkedIn post, ≤ 220 words, professional tone, one call to action." },
  cabinet_memo: { kind: "memo", audience: "Cabinet + senior officials", instructions: "Confidential memo — situation, decision needed, options, recommendation." },
  radio_60: { kind: "speech", audience: "Local radio listeners", instructions: "60-second radio script, conversational, one big idea." },
  op_ed_lede: { kind: "op_ed", audience: "Regional broadsheet", instructions: "First 200 words of an op-ed under the PM's byline — hook + thesis." },
};

export const generateChannelDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      strategyId: z.string().uuid(),
      signalId: z.string().uuid().optional(),
      channel: z.enum([
        "press_release", "pm_statement", "x_thread", "linkedin", "cabinet_memo", "radio_60", "op_ed_lede",
      ]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: strat } = await context.supabase
      .from("strategy_statements")
      .select("id,scope_key,sector_code,title,seven_part,sources")
      .eq("id", data.strategyId).single();
    if (!strat) throw new Error("Strategy not found.");

    const spec = CHANNEL_SPECS[data.channel];
    const seven = strat.seven_part as Record<string, unknown>;
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) throw new Error("PERPLEXITY_API_KEY not configured");

    const prompt = [
      `Country: ${strat.scope_key} · Sector: ${strat.sector_code}`,
      `Strategy title: ${strat.title}`,
      `Seven-part frame:\n${JSON.stringify(seven, null, 2)}`,
      "",
      `Channel: ${data.channel}`,
      `Audience: ${spec.audience}`,
      `Instructions: ${spec.instructions}`,
      "",
      "Write the artifact as plain markdown. Do not include commentary. Ground in the strategy — no invented figures.",
    ].join("\n");

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are the PM's senior speechwriter. Deliver publishable copy." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Perplexity channel draft failed [${res.status}]: ${body}`);
    }
    const j = await res.json();
    const body: string = j?.choices?.[0]?.message?.content ?? "";

    const { data: row, error } = await context.supabase
      .from("comms_artifacts")
      .insert({
        scope_key: strat.scope_key,
        strategy_id: strat.id,
        signal_id: data.signalId ?? null,
        kind: spec.kind,
        audience: spec.audience,
        channel: data.channel,
        body,
        draft_state: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.signalId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("narrative_lineage").insert({
        signal_id: data.signalId,
        artifact_type: "comms",
        artifact_id: row.id,
        scope_key: strat.scope_key,
        sector_code: strat.sector_code,
        created_by: context.userId,
      });
    }

    return { id: row.id };
  });

// ─── Publish (mark released + record URL) ───────────────────────────────────

export const publishArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), publishedUrl: z.string().url().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("comms_artifacts")
      .update({
        draft_state: "released",
        released_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        published_url: data.publishedUrl ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Artifacts for a signal ─────────────────────────────────────────────────

export const listArtifactsForSignal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ signalId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: lineage } = await context.supabase
      .from("narrative_lineage")
      .select("artifact_type,artifact_id,created_at")
      .eq("signal_id", data.signalId);

    const stratIds = (lineage ?? []).filter((l) => l.artifact_type === "strategy").map((l) => l.artifact_id);
    const commsIds = (lineage ?? []).filter((l) => l.artifact_type === "comms").map((l) => l.artifact_id);

    const [{ data: strategies }, { data: comms }] = await Promise.all([
      stratIds.length
        ? context.supabase.from("strategy_statements").select("id,title,status,version,updated_at").in("id", stratIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; status: string; version: number; updated_at: string }> }),
      commsIds.length
        ? context.supabase.from("comms_artifacts").select("id,channel,kind,audience,draft_state,released_at,published_url,updated_at").in("id", commsIds)
        : Promise.resolve({ data: [] as Array<{ id: string; channel: string | null; kind: string; audience: string; draft_state: string; released_at: string | null; published_url: string | null; updated_at: string }> }),
    ]);

    return { strategies: strategies ?? [], comms: comms ?? [] };
  });
