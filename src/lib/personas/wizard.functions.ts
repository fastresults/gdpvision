// Chamber 07 · Research Studio Wizard — server functions.
// Corpus-first, McKinsey-grade brief → outcome → cast → commit pipeline.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { buildCountryContextPack, type ContextCitation } from "./context-pack.server";
import {
  refsFromTextAndModel,
  sanitizeCitationMarkersInText,
  sanitizeJsonCitationMarkers,
  validCitationsForRefs,
} from "@/lib/citations/hygiene";

const GEN_MODEL_PRIMARY = "google/gemini-3.5-flash";
const GEN_MODEL_FALLBACK = "google/gemini-3.1-flash-lite";
const GATEWAY_TIMEOUT_MS = 45_000;

type GatewayResult = { content: string; model: string; runId?: string };

async function callGateway(
  system: string,
  user: string,
  opts: { model?: string; temperature?: number; timeoutMs?: number } = {},
): Promise<GatewayResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const model = opts.model ?? GEN_MODEL_PRIMARY;
  const timeoutMs = opts.timeoutMs ?? GATEWAY_TIMEOUT_MS;

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${system}\n\nRespond with a single valid JSON object only. No prose, no markdown fences.` },
          { role: "user", content: user },
        ],
        temperature: opts.temperature ?? 0.4,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = e as Error & { name?: string };
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error(`AI Gateway timed out after ${Math.round(timeoutMs / 1000)}s (${model})`);
    }
    throw new Error(`AI Gateway network error (${model}): ${err?.message ?? String(e)}`);
  }
  const runId = res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI Gateway ${res.status} (${model}): ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null };
      error?: { code?: number; message?: string };
    }>;
  };
  const choice = j.choices?.[0];
  const content = choice?.message?.content?.trim();
  if (!content) {
    const reason = choice?.error?.message || choice?.finish_reason || "empty response";
    throw new Error(`AI upstream failure (${model}): ${reason}`);
  }
  return { content, model, runId };
}

/**
 * Robust JSON extractor.
 * - Strips ```json / ``` fences
 * - Removes leading reasoning/prose before the first `{`
 * - Balances braces to find the largest valid top-level object
 * - Tolerates trailing commentary after the closing brace
 */
function safeParse<T = unknown>(s: string): T | null {
  if (!s) return null;
  const cleaned = s
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json|JSON)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();
  try { return JSON.parse(cleaned) as T; } catch { /* try extraction */ }

  const first = cleaned.indexOf("{");
  if (first < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = first; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const slice = cleaned.slice(first, i + 1);
        try { return JSON.parse(slice) as T; } catch { /* keep scanning */ }
      }
    }
  }
  // Last resort — greedy regex
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch { /* noop */ } }
  return null;
}

/**
 * Structured AI call with self-repair and model fallback.
 * Returns parsed JSON + provenance. Throws only when every attempt fails.
 */
async function callStructured<T>(
  system: string,
  user: string,
  validate: (v: unknown) => v is T,
): Promise<{ value: T; ai_status: "enriched" | "repaired" | "fallback"; ai_model: string; ai_run_id?: string; ai_raw_excerpt: string }> {
  const attempts: Array<{ model: string; temperature?: number }> = [
    { model: GEN_MODEL_PRIMARY, temperature: 0.35 },
    { model: GEN_MODEL_FALLBACK, temperature: 0.2 }, // fast fallback — no third attempt to preserve Worker budget
  ];
  let lastRaw = "";
  let lastError: unknown;
  let lastModel = "";
  let lastRunId: string | undefined;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const userMsg = i > 0 && lastRaw
        ? `${user}\n\n---\nYour previous response was not valid JSON matching the required shape. You returned:\n${lastRaw.slice(0, 1200)}\n\nReturn the SAME content, but as a single valid JSON object matching the schema above. No prose, no fences.`
        : user;
      const res = await callGateway(system, userMsg, attempt);
      lastRaw = res.content;
      lastModel = res.model;
      lastRunId = res.runId;
      const parsed = safeParse<unknown>(res.content);
      if (parsed && validate(parsed)) {
        const status = i === 0 ? "enriched" : "fallback";
        return { value: parsed, ai_status: status, ai_model: res.model, ai_run_id: res.runId, ai_raw_excerpt: res.content.slice(0, 800) };
      }
    } catch (e) {
      lastError = e;
    }
  }
  const err = new Error(
    `AI structured call failed after ${attempts.length} attempts (last model: ${lastModel || "n/a"}${lastRunId ? `, run: ${lastRunId}` : ""}): ${
      lastError instanceof Error ? lastError.message : "unparseable response"
    }`,
  );
  (err as Error & { raw?: string; runId?: string; model?: string }).raw = lastRaw.slice(0, 800);
  (err as Error & { raw?: string; runId?: string; model?: string }).runId = lastRunId;
  (err as Error & { raw?: string; runId?: string; model?: string }).model = lastModel;
  throw err;
}

async function perplexityDeepResearch(query: string, country: string, timeoutMs = 30_000): Promise<{
  answer: string;
  citations: string[];
}> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { answer: "", citations: [] };
  let res: Response;
  try {
    res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a McKinsey-grade research analyst. Return a 3-6 sentence factual synthesis grounded in cited web sources. Every claim must be citable." },
          { role: "user", content: `Country: ${country}\nResearch question: ${query}\n\nSynthesize what is publicly known, with concrete numbers and named stakeholders where possible.` },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { answer: "", citations: [] };
  }
  if (!res.ok) return { answer: "", citations: [] };
  const j = await res.json().catch(() => null);
  if (!j) return { answer: "", citations: [] };
  const answer: string = j?.choices?.[0]?.message?.content ?? "";
  const citations: string[] = Array.isArray(j?.citations) ? j.citations : [];
  return { answer, citations };
}

// ── Drafts ─────────────────────────────────────────────────────────────────

const CreateDraftInput = z.object({
  countryCode: z.string().min(2).max(4),
  title: z.string().max(240).optional(),
});

export const createDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateDraftInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("persona_study_drafts")
      .insert({
        country_code: data.countryCode,
        title: data.title ?? null,
        step: "brief",
        visibility: "private",
        owner_country_code: data.countryCode,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("persona_study_drafts")
      .select("id,title,step,updated_at,created_at,brief_raw,outcome_blueprint,cast_draft,uploads,autorun_status,locked_at,study_id")
      .eq("country_code", data.countryCode)
      .order("updated_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const bp = r.outcome_blueprint as { deliverables?: unknown[] } | null;
      const cast = r.cast_draft as { personas?: unknown[]; segments?: unknown[]; instruments?: unknown[] } | null;
      const uploads = Array.isArray(r.uploads) ? r.uploads : [];
      return {
        id: r.id as string,
        title: r.title as string | null,
        step: r.step as string,
        updated_at: r.updated_at as string,
        created_at: r.created_at as string,
        brief_raw: r.brief_raw as string | null,
        deliverable_count: Array.isArray(bp?.deliverables) ? bp!.deliverables!.length : 0,
        persona_count: Array.isArray(cast?.personas) ? cast!.personas!.length : 0,
        segment_count: Array.isArray(cast?.segments) ? cast!.segments!.length : 0,
        instrument_count: Array.isArray(cast?.instruments) ? cast!.instruments!.length : 0,
        upload_count: uploads.length,
        autorun_status: (r as { autorun_status?: unknown }).autorun_status ?? null,
        locked_at: (r as { locked_at?: string | null }).locked_at ?? null,
        study_id: (r as { study_id?: string | null }).study_id ?? null,
      };
    });
  });

const RenameDraftInput = z.object({ id: z.string().uuid(), title: z.string().min(1).max(240) });
export const renameDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RenameDraftInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_study_drafts")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: src, error: readErr } = await context.supabase
      .from("persona_study_drafts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!src) throw new Error("Draft not found");
    const { id: _id, created_at: _c, updated_at: _u, created_by: _cb, ...rest } = src as Record<string, unknown>;
    const copy = {
      ...rest,
      title: `${(src.title as string | null) ?? "Untitled brief"} (copy)`,
      created_by: context.userId,
    };
    const { data: inserted, error: insErr } = await context.supabase
      .from("persona_study_drafts")
      .insert(copy as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { id: inserted.id as string };
  });


export const getDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("persona_study_drafts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Draft not found");
    return row;
  });

const SaveDraftInput = z.object({
  id: z.string().uuid(),
  patch: z.record(z.string(), z.unknown()),
});

const DRAFT_ALLOWED_KEYS = new Set([
  "title", "step", "brief_raw", "brief_scope", "outcome_raw",
  "outcome_blueprint", "cast_draft", "uploads", "autorun_status",
]);

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveDraftInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) {
      if (DRAFT_ALLOWED_KEYS.has(k)) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("persona_study_drafts")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_study_drafts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Step 1: Enrich brief → Research Scope ─────────────────────────────────

const EnrichBriefInput = z.object({
  draftId: z.string().uuid(),
  countryCode: z.string(),
  raw: z.string().min(3).max(20000),
});

export type ResearchScope = {
  title: string;
  objectives: string[];
  hypotheses: string[];
  decisions: string[];
  stakeholders: { name: string; type: "internal" | "external"; role: string }[];
  timeframe: string;
  geography: string;
  sensitivities: string[];
  success_criteria: string[];
};

export const enrichBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnrichBriefInput.parse(d))
  .handler(async ({ data, context }) => {
    // Idempotency: skip if already enriched.
    const { data: existing } = await context.supabase
      .from("persona_study_drafts")
      .select("brief_scope")
      .eq("id", data.draftId)
      .maybeSingle();
    if (existing?.brief_scope) {
      return { scope: existing.brief_scope as unknown as ResearchScope, alreadyDone: true as const };
    }
    const pack = await buildCountryContextPack(context.supabase, data.countryCode, data.raw.slice(0, 400));
    const scoped = await callStructured<ResearchScope>(
      "You are a McKinsey engagement partner scoping a sovereign research study. Convert the client's raw brief into a rigorous Research Scope. Return strict JSON only.",
      `RAW BRIEF (may be typed, transcribed from voice, or extracted from an upload):\n${data.raw}\n\n${pack.block}\n\nReturn JSON:
{
  "title": "≤ 90 char headline for this study",
  "objectives": ["3-6 crisp objectives"],
  "hypotheses": ["3-5 falsifiable hypotheses"],
  "decisions": ["decisions this research must inform, 2-4"],
  "stakeholders": [{"name":"…","type":"internal|external","role":"…"}],
  "timeframe": "when this must be delivered / time horizon",
  "geography": "geographies in scope",
  "sensitivities": ["political/reputational risks to handle carefully"],
  "success_criteria": ["what 'done well' looks like, 3-5"]
}`,
      (v): v is ResearchScope =>
        !!v && typeof v === "object" && typeof (v as ResearchScope).title === "string" && (v as ResearchScope).title.length > 0,
    );
    const parsed = scoped.value;
    await context.supabase
      .from("persona_study_drafts")
      .update({
        brief_raw: data.raw,
        brief_scope: parsed as unknown as Json,
        title: parsed.title.slice(0, 240),
        step: "outcome",
      })
      .eq("id", data.draftId);
    return { scope: parsed };
  });

// ── Step 2: Deliverable blueprint ─────────────────────────────────────────

const DELIVERABLE_LIBRARY = [
  { code: "scqa_memo",         label: "SCQA memo",                  desc: "1-page McKinsey Situation–Complication–Question–Answer memo." },
  { code: "stakeholder_map",   label: "MECE stakeholder map",        desc: "Internal + external stakeholders, influence × interest, priorities." },
  { code: "focus_group_guide", label: "Focus-group discussion guide", desc: "Warm-up → probes → tension moments → close." },
  { code: "survey",            label: "Survey instrument",           desc: "Likert + open-ended questions with segmentation cuts." },
  { code: "interview_protocol",label: "Interview protocol",           desc: "Semi-structured guide with fallbacks and follow-ups." },
  { code: "brand_scorecard",   label: "Brand-alignment scorecard",   desc: "Attribute × audience matrix with delta vs original intent." },
  { code: "segment_matrix",    label: "Segment × message matrix",    desc: "Which message lands where and why, with objections." },
  { code: "exec_readout",      label: "Exec readout deck",           desc: "10-slide Pyramid-Principle deck for cabinet-level briefing." },
] as const;

export const listDeliverables = createServerFn({ method: "GET" }).handler(async () => DELIVERABLE_LIBRARY);

const EnrichOutcomeInput = z.object({
  draftId: z.string().uuid(),
  countryCode: z.string(),
  raw: z.string().max(20000).optional(),
  selectedCodes: z.array(z.string()).min(1).max(12),
  tone: z.enum(["cabinet", "investor", "public"]).default("cabinet"),
});

export type DeliverableBlueprint = {
  tone: "cabinet" | "investor" | "public";
  deliverables: {
    code: string;
    label: string;
    sections: string[];
    evidence_density: "low" | "medium" | "high";
    length_hint: string;
  }[];
  ai_status?: "enriched" | "repaired" | "fallback" | "scaffold_only";
  ai_model?: string;
  ai_run_id?: string;
  ai_raw_excerpt?: string;
  ai_error?: string;
};

// Hand-authored McKinsey-grade scaffolds for every deliverable in the library.
// This is the deterministic floor: Step 2 can never bottom out on AI failure.
const DELIVERABLE_TEMPLATES: Record<string, { sections: string[]; evidence_density: "low" | "medium" | "high"; length_hint: string }> = {
  scqa_memo: {
    sections: ["Situation (baseline & context)", "Complication (what changed / why now)", "Question (the decision at hand)", "Answer (recommended path + rationale)", "Evidence & citations"],
    evidence_density: "high",
    length_hint: "1 page (400–600 words)",
  },
  stakeholder_map: {
    sections: ["Internal stakeholders (name, role, mandate)", "External stakeholders (name, role, leverage)", "Influence × interest matrix", "Coalitions & swing actors", "Engagement priorities & sequencing"],
    evidence_density: "high",
    length_hint: "2 pages · 1 matrix + narrative",
  },
  focus_group_guide: {
    sections: ["Warm-up & ground rules (5 min)", "Context probes (10 min)", "Concept reactions (15 min)", "Tension moments & trade-offs (15 min)", "Prioritization exercise (10 min)", "Close & next steps (5 min)"],
    evidence_density: "medium",
    length_hint: "60-min moderator guide",
  },
  survey: {
    sections: ["Screener questions", "Awareness & usage (multi-select)", "Attitudinal Likert battery (7-point)", "Trade-off / MaxDiff block", "Open-ended verbatims", "Demographics & segmentation cuts"],
    evidence_density: "medium",
    length_hint: "12–15 min, ~25 questions",
  },
  interview_protocol: {
    sections: ["Interviewee context (2 min)", "Opening narrative prompt", "Structured probes (5–7)", "Counterfactual / falsification probes", "Named-example asks", "Close & follow-up commitments"],
    evidence_density: "high",
    length_hint: "45-min semi-structured guide",
  },
  brand_scorecard: {
    sections: ["Attribute × audience matrix (rows = attributes, cols = audiences)", "Delta vs original brand intent", "Evidence anchors per cell", "Gap register with severity", "Recommended shifts"],
    evidence_density: "high",
    length_hint: "1 matrix + 1 page narrative",
  },
  segment_matrix: {
    sections: ["Segment definitions (size, distribution, drivers)", "Message × segment fit matrix", "Objections & counters per segment", "Channel & tone recommendations", "Test-and-learn plan"],
    evidence_density: "medium",
    length_hint: "2 pages · 1 matrix + notes",
  },
  exec_readout: {
    sections: ["Cover · one-line ask", "Situation snapshot", "Complication", "Governing thought (Pyramid principle)", "3 supporting arguments (evidence per arg)", "Options considered", "Recommendation & mandate needed", "Risks & mitigations", "Timeline & owners", "Appendix · evidence & citations"],
    evidence_density: "high",
    length_hint: "10-slide cabinet-level deck",
  },
};

function scaffoldBlueprint(picks: ReadonlyArray<{ code: string; label: string; desc: string }>, tone: "cabinet" | "investor" | "public"): DeliverableBlueprint {
  return {
    tone,
    deliverables: picks.map((p) => {
      const tpl = DELIVERABLE_TEMPLATES[p.code] ?? {
        sections: ["Executive summary", "Method", "Findings", "Recommendations", "Evidence & citations"],
        evidence_density: "medium" as const,
        length_hint: "1–2 pages",
      };
      return { code: p.code, label: p.label, sections: [...tpl.sections], evidence_density: tpl.evidence_density, length_hint: tpl.length_hint };
    }),
  };
}

function mergeAiIntoScaffold(scaffold: DeliverableBlueprint, ai: DeliverableBlueprint): DeliverableBlueprint {
  const byCode = new Map(ai.deliverables.map((d) => [d.code, d]));
  return {
    tone: ai.tone ?? scaffold.tone,
    deliverables: scaffold.deliverables.map((s) => {
      const a = byCode.get(s.code);
      if (!a) return s;
      return {
        code: s.code,
        label: s.label,
        sections: Array.isArray(a.sections) && a.sections.length ? a.sections.slice(0, 20).map(String) : s.sections,
        evidence_density: (["low", "medium", "high"] as const).includes(a.evidence_density) ? a.evidence_density : s.evidence_density,
        length_hint: typeof a.length_hint === "string" && a.length_hint.length ? a.length_hint : s.length_hint,
      };
    }),
  };
}

async function enrichBlueprintWithAi(
  scaffold: DeliverableBlueprint,
  scope: unknown,
  extraGuidance: string | undefined,
  picks: ReadonlyArray<{ code: string; label: string; desc: string }>,
): Promise<DeliverableBlueprint> {
  const system =
    "You are a McKinsey communications director. Refine the provided deliverable SCAFFOLD to fit the study scope, tone, and any user guidance. Keep the same `code` values. Tighten `sections` to be sharp and MECE. Set `evidence_density` (low|medium|high) and `length_hint` realistically. Return strict JSON only.";
  const user = `SCOPE:\n${JSON.stringify(scope ?? {}, null, 2)}\n\nEXTRA GUIDANCE FROM USER:\n${extraGuidance?.trim() || "(none)"}\n\nSELECTED DELIVERABLES:\n${picks.map((p) => `- ${p.code}: ${p.label} — ${p.desc}`).join("\n")}\n\nSCAFFOLD (refine, don't replace):\n${JSON.stringify(scaffold, null, 2)}\n\nReturn JSON exactly:
{
  "tone": "${scaffold.tone}",
  "deliverables": [
    { "code": "…", "label": "…", "sections": ["…"], "evidence_density": "low|medium|high", "length_hint": "e.g. 1 page, 12 slides, 40-min guide" }
  ]
}`;
  const validate = (v: unknown): v is DeliverableBlueprint =>
    !!v && typeof v === "object"
      && Array.isArray((v as DeliverableBlueprint).deliverables)
      && (v as DeliverableBlueprint).deliverables.length > 0
      && (v as DeliverableBlueprint).deliverables.every((d) => typeof d?.code === "string");

  const res = await callStructured<DeliverableBlueprint>(system, user, validate);
  const merged = mergeAiIntoScaffold(scaffold, res.value);
  return {
    ...merged,
    ai_status: res.ai_status,
    ai_model: res.ai_model,
    ai_run_id: res.ai_run_id,
    ai_raw_excerpt: res.ai_raw_excerpt,
  };
}

export const enrichOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnrichOutcomeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: draft } = await context.supabase
      .from("persona_study_drafts")
      .select("brief_scope,brief_raw,outcome_blueprint")
      .eq("id", data.draftId)
      .maybeSingle();
    // Idempotency: skip when we already have an AI-enriched blueprint.
    const existingBp = draft?.outcome_blueprint as DeliverableBlueprint | null;
    if (existingBp?.deliverables?.length && existingBp.ai_status && existingBp.ai_status !== "scaffold_only") {
      return { blueprint: existingBp, alreadyDone: true as const };
    }
    const picks = DELIVERABLE_LIBRARY.filter((d) => data.selectedCodes.includes(d.code));
    if (picks.length === 0) throw new Error("Select at least one deliverable.");

    const scaffold = scaffoldBlueprint(picks, data.tone);
    let blueprint: DeliverableBlueprint;
    try {
      blueprint = await enrichBlueprintWithAi(scaffold, draft?.brief_scope, data.raw, picks);
    } catch (e) {
      const err = e as Error & { raw?: string; runId?: string; model?: string };
      blueprint = {
        ...scaffold,
        ai_status: "scaffold_only",
        ai_model: err.model,
        ai_run_id: err.runId,
        ai_raw_excerpt: err.raw,
        ai_error: err.message?.slice(0, 400),
      };
    }

    await context.supabase
      .from("persona_study_drafts")
      .update({
        outcome_raw: data.raw ?? null,
        outcome_blueprint: blueprint as unknown as Json,
        step: "cast",
      })
      .eq("id", data.draftId);
    return { blueprint };
  });

// Retry only the AI enrichment on an existing draft (keeps scaffold as floor).
const RetryOutcomeInput = z.object({ draftId: z.string().uuid() });
export const retryOutcomeAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RetryOutcomeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: draft } = await context.supabase
      .from("persona_study_drafts")
      .select("brief_scope,outcome_raw,outcome_blueprint")
      .eq("id", data.draftId)
      .maybeSingle();
    const existing = (draft?.outcome_blueprint as DeliverableBlueprint | null) ?? null;
    if (!existing?.deliverables?.length) throw new Error("Build the blueprint first.");
    const picks = DELIVERABLE_LIBRARY.filter((d) => existing.deliverables.some((x) => x.code === d.code));
    const scaffold = scaffoldBlueprint(picks, existing.tone ?? "cabinet");
    let blueprint: DeliverableBlueprint;
    try {
      blueprint = await enrichBlueprintWithAi(scaffold, draft?.brief_scope, draft?.outcome_raw ?? undefined, picks);
    } catch (e) {
      const err = e as Error & { raw?: string; runId?: string; model?: string };
      blueprint = { ...scaffold, ai_status: "scaffold_only", ai_model: err.model, ai_run_id: err.runId, ai_raw_excerpt: err.raw, ai_error: err.message?.slice(0, 400) };
    }
    await context.supabase
      .from("persona_study_drafts")
      .update({ outcome_blueprint: blueprint as unknown as Json })
      .eq("id", data.draftId);
    return { blueprint };
  });

// ── Step 3: Draft cast (personas + segments + instruments + evidence) ─────

const DraftCastInput = z.object({
  draftId: z.string().uuid(),
  countryCode: z.string(),
  personaCount: z.number().int().min(4).max(16).default(8),
  segmentCount: z.number().int().min(2).max(6).default(4),
  allowDeepResearch: z.boolean().default(true),
});

type PersonaDraft = {
  name: string;
  archetype: string;
  summary: string;
  attributes: Json;
  motivations: string[];
  objections: string[];
  quote: string;
  grounding_refs: number[];
};

type SegmentDraft = {
  label: string;
  size_hint: string;
  distribution: Json;
  member_indexes: number[];
  grounding_refs: number[];
};

type InstrumentDraft = {
  kind: string;
  title: string;
  body: Json;
};

type CastDraft = {
  personas: PersonaDraft[];
  segments: SegmentDraft[];
  instruments: InstrumentDraft[];
  missing_evidence: string[];
  deep_research: { question: string; answer: string; citations: string[] }[];
  evidence_summary: { corpus: number; uploads: number; deep_research: number };
};

export const draftCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DraftCastInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: draft } = await context.supabase
      .from("persona_study_drafts")
      .select("brief_scope,outcome_blueprint,uploads,cast_draft")
      .eq("id", data.draftId)
      .maybeSingle();
    if (!draft?.brief_scope) throw new Error("Complete the brief step first.");
    const existingCast = draft.cast_draft as CastDraft | null;
    if (existingCast?.personas?.length) {
      return { cast: existingCast, contextCitations: [], alreadyDone: true as const };
    }

    const scope = draft.brief_scope as ResearchScope;
    const blueprint = (draft.outcome_blueprint as DeliverableBlueprint) ?? { tone: "cabinet", deliverables: [] };
    const uploadsText = Array.isArray(draft.uploads) && draft.uploads.length
      ? `UPLOADED EVIDENCE (excerpts):\n${(draft.uploads as Array<Record<string, unknown>>).slice(0, 6).map((u, i) => `[U${i + 1}] ${String(u.name ?? "file")}: ${String(u.excerpt ?? "").slice(0, 500)}`).join("\n\n")}`
      : "";

    const pack = await buildCountryContextPack(
      context.supabase,
      data.countryCode,
      `${scope.title}\n${scope.objectives?.join("\n") ?? ""}`,
    );

    const gapProbeRaw = await callGateway(
      "You are a research director. Given the study scope and available context, list up to 3 concrete evidence gaps that must be closed with fresh open-web research before the cast can be trusted. Return strict JSON.",
      `SCOPE:\n${JSON.stringify(scope, null, 2)}\n\n${pack.block}\n\n${uploadsText}\n\nReturn: { "gaps": ["specific web-researchable question", ...] }`,
    );
    const gaps = (safeParse<{ gaps: string[] }>(gapProbeRaw.content)?.gaps ?? []).slice(0, 3);

    // Run gap probes in parallel with per-call timeout + global 90s wall budget.
    let deepResearch: { question: string; answer: string; citations: string[] }[] = [];
    let partialDeepResearch = false;
    if (data.allowDeepResearch && gaps.length) {
      const wallDeadline = Date.now() + 90_000;
      const results = await Promise.allSettled(
        gaps.map(async (q) => {
          const remaining = Math.max(5_000, wallDeadline - Date.now());
          const dr = await perplexityDeepResearch(q, data.countryCode, Math.min(30_000, remaining));
          return dr.answer ? { question: q, ...dr } : null;
        }),
      );
      deepResearch = results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((v): v is NonNullable<typeof v> => v !== null);
      partialDeepResearch = deepResearch.length < gaps.length;
    }

    const deepBlock = deepResearch.length
      ? `\nDEEP RESEARCH (open web):\n${deepResearch.map((d, i) => `[D${i + 1}] Q: ${d.question}\nA: ${d.answer}\nSOURCES: ${d.citations.slice(0, 5).join(", ")}`).join("\n\n")}`
      : "";

    const castRaw = await callGateway(
      "You are the McKinsey partner casting a research study. Produce a diverse, non-consensus cast grounded ONLY in the provided corpus + uploaded + deep-research evidence. Cite [N] context refs. Return strict JSON.",
      `SCOPE:\n${JSON.stringify(scope, null, 2)}\n\nDELIVERABLE BLUEPRINT:\n${JSON.stringify(blueprint, null, 2)}\n\n${pack.block}\n\n${uploadsText}${deepBlock}\n\nGenerate exactly ${data.personaCount} distinct personas and ${data.segmentCount} segments. Also draft ${blueprint.deliverables.length || 3} instruments matching the blueprint (focus_group, survey, interview_protocol, scorecard as needed).\n\nReturn JSON:
{
  "personas": [
    { "name":"First Last", "archetype":"short label", "summary":"3-4 sentences citing [N]",
      "attributes": {"age":0,"location":"…","occupation":"…","income":"…","values":["…"],"media":["…"]},
      "motivations":["…"], "objections":["…"], "quote":"one-line verbatim",
      "grounding_refs":[N,...] }
  ],
  "segments": [
    { "label":"3-6 word title", "size_hint":"e.g. ~35% of applicants",
      "distribution": {"age":"…","income":"…","notes":"…"},
      "member_indexes":[0,1,4], "grounding_refs":[N,...] }
  ],
  "instruments": [
    { "kind":"focus_group|survey|interview_protocol|scorecard", "title":"…",
      "body": { "questions":[{"id":"Q1","text":"…","type":"open|likert|multi"}], "notes":"…" } }
  ]
}
Rules: every persona and segment MUST cite at least one grounding_ref. member_indexes reference personas by array index. Instruments must be immediately usable in a real session.`,
    );
    const parsed = safeParse<Omit<CastDraft, "missing_evidence" | "deep_research" | "evidence_summary">>(castRaw.content);
    if (!parsed?.personas?.length) throw new Error("AI returned no cast — try again.");

    const cast: CastDraft = {
      personas: parsed.personas.slice(0, data.personaCount),
      segments: (parsed.segments ?? []).slice(0, data.segmentCount),
      instruments: parsed.instruments ?? [],
      missing_evidence: gaps,
      deep_research: deepResearch,
      evidence_summary: {
        corpus: pack.citations.length,
        uploads: Array.isArray(draft.uploads) ? (draft.uploads as unknown[]).length : 0,
        deep_research: deepResearch.length,
      },
      ...(partialDeepResearch ? { partial: true } : {}),
    } as CastDraft & { partial?: boolean };

    await context.supabase
      .from("persona_study_drafts")
      .update({
        cast_draft: cast as unknown as Json,
        step: "preview",
      })
      .eq("id", data.draftId);

    return { cast, contextCitations: pack.citations };
  });

// ── Step 5: Commit study ───────────────────────────────────────────────────

const CommitStudyInput = z.object({
  draftId: z.string().uuid(),
  countryCode: z.string(),
  visibility: z.enum(["public", "private"]).default("private"),
});

export const commitStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitStudyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: draft } = await supabase
      .from("persona_study_drafts")
      .select("*")
      .eq("id", data.draftId)
      .maybeSingle();
    if (!draft?.cast_draft) throw new Error("Complete the cast step first.");
    if ((draft as { study_id?: string | null }).study_id) {
      return { studyId: (draft as { study_id: string }).study_id, personaCount: (draft.cast_draft as CastDraft).personas.length, alreadyDone: true as const };
    }

    const scope = (draft.brief_scope as ResearchScope) ?? { title: draft.title ?? "Untitled study" };
    const cast = draft.cast_draft as CastDraft;
    const pack = await buildCountryContextPack(supabase, data.countryCode, scope.title);

    // Segment
    const primarySegmentDraft = cast.segments[0];
    const segmentLabel = primarySegmentDraft?.label ?? scope.title.slice(0, 60);
    const { data: seg, error: segErr } = await supabase
      .from("persona_segments")
      .insert({
        country_code: data.countryCode,
        label: segmentLabel.slice(0, 120),
        prompt: scope.title.slice(0, 500),
        distribution: (primarySegmentDraft?.distribution ?? {}) as never,
        size: cast.personas.length,
        visibility: data.visibility,
        owner_user_id: userId,
        owner_country_code: data.visibility === "private" ? data.countryCode : null,
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (segErr) throw new Error(segErr.message);

    // Personas
    const personaRows = cast.personas.map((p) => {
      const rawSummary = p.summary ? String(p.summary).slice(0, 2000) : null;
      const citations = validCitationsForRefs(pack.citations, refsFromTextAndModel(rawSummary, p.grounding_refs));
      return {
        country_code: data.countryCode,
        name: String(p.name ?? "Unnamed").slice(0, 120),
        archetype: p.archetype ? String(p.archetype).slice(0, 120) : null,
        summary: rawSummary ? sanitizeCitationMarkersInText(rawSummary, citations) : null,
        attributes: sanitizeJsonCitationMarkers(
          { ...((p.attributes ?? {}) as Record<string, Json>), motivations: p.motivations, objections: p.objections, quote: p.quote },
          citations,
        ) as never,
        ocean: {} as never,
        grounding_refs: (Array.isArray(p.grounding_refs) ? p.grounding_refs : []) as never,
        citations: citations as never,
        origin: "ai" as const,
        visibility: data.visibility,
        owner_user_id: userId,
        owner_country_code: data.visibility === "private" ? data.countryCode : null,
        uploaded_by: userId,
      };
    });
    const { data: personaInserts, error: pErr } = await supabase
      .from("personas")
      .insert(personaRows)
      .select("id");
    if (pErr) throw new Error(pErr.message);
    const personaIds = (personaInserts ?? []).map((r) => r.id);
    if (personaIds.length) {
      await supabase.from("persona_segment_members").insert(
        personaIds.map((id) => ({ segment_id: seg.id, persona_id: id })),
      );
    }

    // Study
    const { data: study, error: studyErr } = await supabase
      .from("studies")
      .insert({
        country_code: data.countryCode,
        kind: cast.instruments[0]?.kind ?? "focus_group",
        title: scope.title.slice(0, 240),
        objective: (scope.objectives ?? []).slice(0, 3).join(" · ").slice(0, 500),
        segment_id: seg.id,
        status: "draft",
        config: {
          scope,
          blueprint: draft.outcome_blueprint ?? {},
          evidence_summary: cast.evidence_summary,
        } as never,
        visibility: data.visibility,
        owner_user_id: userId,
        owner_country_code: data.visibility === "private" ? data.countryCode : null,
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (studyErr) throw new Error(studyErr.message);

    // Instruments
    if (cast.instruments.length) {
      await supabase.from("study_instruments").insert(
        cast.instruments.map((ins) => ({
          study_id: study.id,
          country_code: data.countryCode,
          kind: ins.kind,
          title: String(ins.title ?? ins.kind).slice(0, 240),
          body: (ins.body ?? {}) as never,
          visibility: data.visibility,
          owner_country_code: data.visibility === "private" ? data.countryCode : null,
          uploaded_by: userId,
        })),
      );
    }

    // Evidence ledger
    const evidence: Array<Record<string, unknown>> = [];
    for (const c of pack.citations.slice(0, 30)) {
      evidence.push({
        study_id: study.id,
        country_code: data.countryCode,
        origin: "corpus",
        visibility: "public",
        title: c.title ?? c.label,
        url: c.url ?? null,
        snippet: c.label,
        uploaded_by: userId,
      });
    }
    for (const dr of cast.deep_research ?? []) {
      for (const u of dr.citations.slice(0, 5)) {
        evidence.push({
          study_id: study.id,
          country_code: data.countryCode,
          origin: "deep_research",
          visibility: "public",
          title: dr.question,
          url: u,
          snippet: dr.answer.slice(0, 300),
          uploaded_by: userId,
        });
      }
    }
    for (const u of (Array.isArray(draft.uploads) ? draft.uploads : []) as Array<Record<string, unknown>>) {
      evidence.push({
        study_id: study.id,
        country_code: data.countryCode,
        origin: "upload",
        visibility: "private",
        owner_country_code: data.countryCode,
        title: String(u.name ?? "upload"),
        url: (u.path as string) ?? null,
        snippet: String(u.excerpt ?? "").slice(0, 500),
        uploaded_by: userId,
      });
    }
    if (evidence.length) {
      await supabase.from("study_evidence").insert(evidence as never);
    }

    await supabase
      .from("persona_study_drafts")
      .update({ study_id: study.id, step: "done" })
      .eq("id", data.draftId);
    return { studyId: study.id, segmentId: seg.id, personaCount: personaIds.length };
  });
