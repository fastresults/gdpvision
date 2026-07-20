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

const GEN_MODEL = "google/gemini-2.5-pro";

async function callGateway(system: string, user: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: GEN_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content?.trim() ?? "{}";
}

function safeParse<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* noop */ }
    }
    return null;
  }
}

async function perplexityDeepResearch(query: string, country: string): Promise<{
  answer: string;
  citations: string[];
}> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { answer: "", citations: [] };
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-reasoning-pro",
      messages: [
        { role: "system", content: "You are a McKinsey-grade research analyst. Return a 3-6 sentence factual synthesis grounded in cited web sources. Every claim must be citable." },
        { role: "user", content: `Country: ${country}\nResearch question: ${query}\n\nSynthesize what is publicly known, with concrete numbers and named stakeholders where possible.` },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) return { answer: "", citations: [] };
  const j = await res.json();
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
      .select("id,title,step,updated_at,brief_raw")
      .eq("country_code", data.countryCode)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return rows ?? [];
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
  "outcome_blueprint", "cast_draft", "uploads",
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
    const pack = await buildCountryContextPack(context.supabase, data.countryCode, data.raw.slice(0, 400));
    const raw = await callGateway(
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
    );
    const parsed = safeParse<ResearchScope>(raw);
    if (!parsed?.title) throw new Error("AI could not enrich the brief — try again or add detail.");
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
};

export const enrichOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnrichOutcomeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: draft } = await context.supabase
      .from("persona_study_drafts")
      .select("brief_scope,brief_raw")
      .eq("id", data.draftId)
      .maybeSingle();
    const picks = DELIVERABLE_LIBRARY.filter((d) => data.selectedCodes.includes(d.code));
    if (picks.length === 0) throw new Error("Select at least one deliverable.");
    const raw = await callGateway(
      "You are a McKinsey communications director. For each selected deliverable, define sections, evidence density, and length. Match the requested tone. Return strict JSON.",
      `SCOPE:\n${JSON.stringify(draft?.brief_scope ?? {}, null, 2)}\n\nEXTRA GUIDANCE FROM USER:\n${data.raw ?? "(none)"}\n\nSELECTED DELIVERABLES:\n${picks.map((p) => `- ${p.code}: ${p.label} — ${p.desc}`).join("\n")}\n\nTone: ${data.tone}\n\nReturn JSON:
{
  "tone": "${data.tone}",
  "deliverables": [
    { "code": "…", "label": "…", "sections": ["…"], "evidence_density": "low|medium|high", "length_hint": "e.g. 1 page, 12 slides, 40-min guide" }
  ]
}`,
    );
    const parsed = safeParse<DeliverableBlueprint>(raw);
    if (!parsed?.deliverables?.length) throw new Error("AI returned no blueprint — try again.");
    await context.supabase
      .from("persona_study_drafts")
      .update({
        outcome_raw: data.raw ?? null,
        outcome_blueprint: parsed as unknown as Json,
        step: "cast",
      })
      .eq("id", data.draftId);
    return { blueprint: parsed };
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
  attributes: Record<string, unknown>;
  motivations: string[];
  objections: string[];
  quote: string;
  grounding_refs: number[];
};

type SegmentDraft = {
  label: string;
  size_hint: string;
  distribution: Record<string, unknown>;
  member_indexes: number[];
  grounding_refs: number[];
};

type InstrumentDraft = {
  kind: string;
  title: string;
  body: Record<string, unknown>;
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
      .select("brief_scope,outcome_blueprint,uploads")
      .eq("id", data.draftId)
      .maybeSingle();
    if (!draft?.brief_scope) throw new Error("Complete the brief step first.");

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
      "You are a research director. Given the study scope and available context, list up to 5 concrete evidence gaps that must be closed with fresh open-web research before the cast can be trusted. Return strict JSON.",
      `SCOPE:\n${JSON.stringify(scope, null, 2)}\n\n${pack.block}\n\n${uploadsText}\n\nReturn: { "gaps": ["specific web-researchable question", ...] }`,
    );
    const gaps = (safeParse<{ gaps: string[] }>(gapProbeRaw)?.gaps ?? []).slice(0, 5);

    const deepResearch: { question: string; answer: string; citations: string[] }[] = [];
    if (data.allowDeepResearch) {
      for (const q of gaps) {
        try {
          const dr = await perplexityDeepResearch(q, data.countryCode);
          if (dr.answer) deepResearch.push({ question: q, ...dr });
        } catch { /* skip individual failures */ }
      }
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
    const parsed = safeParse<Omit<CastDraft, "missing_evidence" | "deep_research" | "evidence_summary">>(castRaw);
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
    };

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
          { ...(p.attributes ?? {}), motivations: p.motivations, objections: p.objections, quote: p.quote },
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

    await supabase.from("persona_study_drafts").delete().eq("id", data.draftId);
    return { studyId: study.id, segmentId: seg.id, personaCount: personaIds.length };
  });
