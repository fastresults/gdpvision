// @domain personas
// @tables persona_projects
// @ui src/components/personas/StudyWizard/BlueprintReview.tsx; src/hooks/useProgramBriefGate.ts

// Chamber 07 · Blueprint — AI-first research design proposal.
//
// After the admin commits the Program Brief, `composeBlueprint` reads the
// brief and produces a full research design: which SEGMENTS to hear from
// (with recommended persona counts) and which STUDIES to run against them.
// The admin only needs to review, refine, and approve. Approval is atomic:
// it records `blueprint_committed_at`, and the review UI then drives
// client-side generation using the existing `generateSegment` + autorun
// pipelines.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const MODEL_PRIMARY = "google/gemini-2.5-pro";
const MODEL_FALLBACK = "google/gemini-2.5-flash";
const AI_TIMEOUT_MS = 60_000;

const STUDY_KINDS = ["survey", "focus_group", "creative_test"] as const;
export type StudyKind = (typeof STUDY_KINDS)[number];

export const BlueprintSegmentSchema = z.object({
  label: z.string().min(3).max(120),
  prompt: z.string().min(3).max(600),
  size: z.number().int().min(4).max(12).default(8),
  rationale: z.string().max(600).optional().default(""),
  priority: z.number().int().min(1).max(5).default(3),
});
export const BlueprintStudySchema = z.object({
  segment_label: z.string().min(1),
  kind: z.enum(STUDY_KINDS),
  title: z.string().min(3).max(160),
  objective: z.string().min(3).max(1200),
});
export const BlueprintSchema = z.object({
  segments: z.array(BlueprintSegmentSchema).min(1).max(8),
  studies: z.array(BlueprintStudySchema).min(1).max(16),
  summary: z.string().max(2000).optional().default(""),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

// ── Read ──────────────────────────────────────────────────────────────────
export const getBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("persona_projects")
      .select("id,title,country_code,brief_raw,brief_scope,brief_committed_at,blueprint_proposal,blueprint_generated_at,blueprint_committed_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research program not found");
    return {
      id: row.id as string,
      title: row.title as string,
      countryCode: row.country_code as string,
      briefCommittedAt: row.brief_committed_at as string | null,
      brief_raw: (row.brief_raw as string | null) ?? "",
      brief_scope: (row.brief_scope as unknown) ?? null,
      proposal: (row.blueprint_proposal as unknown as Blueprint | null) ?? null,
      generatedAt: row.blueprint_generated_at as string | null,
      committedAt: row.blueprint_committed_at as string | null,
    };
  });

// ── AI compose ────────────────────────────────────────────────────────────
async function callGateway(system: string, user: string, model: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${system}\n\nReturn a single valid JSON object only.` },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.35,
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 240)}`);
    }
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return j.choices?.[0]?.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

function safeJson<T>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch { /* fall through */ } }
    return null;
  }
}

function coerceBlueprint(raw: unknown): Blueprint | null {
  const parsed = BlueprintSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Repair pass: coerce common shapes.
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const segsIn = Array.isArray(r.segments) ? (r.segments as Array<Record<string, unknown>>) : [];
  const studiesIn = Array.isArray(r.studies) ? (r.studies as Array<Record<string, unknown>>) : [];
  const segments = segsIn
    .map((s) => ({
      label: String(s.label ?? s.name ?? "").slice(0, 120),
      prompt: String(s.prompt ?? s.description ?? s.label ?? "").slice(0, 600),
      size: Math.max(4, Math.min(12, Number(s.size ?? s.persona_count ?? s.count ?? 8) || 8)),
      rationale: String(s.rationale ?? s.why ?? "").slice(0, 600),
      priority: Math.max(1, Math.min(5, Number(s.priority ?? 3) || 3)),
    }))
    .filter((s) => s.label.length >= 3 && s.prompt.length >= 3);
  const studies = studiesIn
    .map((s) => {
      const rawKind = String(s.kind ?? s.method ?? "").toLowerCase();
      const kind: StudyKind = (STUDY_KINDS as readonly string[]).includes(rawKind)
        ? (rawKind as StudyKind)
        : rawKind.includes("focus")
          ? "focus_group"
          : rawKind.includes("creat") || rawKind.includes("test")
            ? "creative_test"
            : "survey";
      return {
        segment_label: String(s.segment_label ?? s.segment ?? "").slice(0, 120),
        kind,
        title: String(s.title ?? "").slice(0, 160),
        objective: String(s.objective ?? s.description ?? "").slice(0, 1200),
      };
    })
    .filter((s) => s.title.length >= 3 && s.segment_label.length >= 1 && s.objective.length >= 3);
  if (!segments.length || !studies.length) return null;
  return { segments, studies, summary: String(r.summary ?? "").slice(0, 2000) };
}

export const composeBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("persona_projects")
      .select("id,title,country_code,brief_raw,brief_scope,brief_uploads,brief_committed_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research program not found");
    if (!row.brief_committed_at) throw new Error("Commit the program brief before generating the blueprint.");

    // ── Assemble the FULL brief (raw + upload excerpts + enriched scope) ──
    const raw = String(row.brief_raw ?? "").trim();
    const uploads = Array.isArray(row.brief_uploads)
      ? (row.brief_uploads as Array<{ name?: string; mime?: string; excerpt?: string }>)
      : [];
    const uploadBlock = uploads
      .filter((u) => u.excerpt && u.excerpt.trim().length > 0)
      .map((u) => `\n\n[UPLOAD: ${u.name ?? "document"} (${u.mime ?? "text"})]\n${u.excerpt}`)
      .join("");
    const scope = row.brief_scope as Record<string, unknown> | null;
    const scopeBlock = scope
      ? `\n\nRESEARCH SCOPE (AI-enriched):\n${JSON.stringify(scope, null, 2)}`
      : "";
    const combinedBrief = `${raw}${uploadBlock}${scopeBlock}`.trim().slice(0, 12_000);

    // ── Auto-augment with country context when the brief is thin ──
    let countryBlock = "";
    let augmented = false;
    if (combinedBrief.length < 400 || !scope) {
      try {
        const { buildCountryContextPack } = await import("./context-pack.server");
        const pack = await buildCountryContextPack(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase as unknown as any,
          row.country_code as string,
          raw.slice(0, 400) || String(row.title ?? ""),
        );
        if (pack?.block) {
          countryBlock = `\n\nCOUNTRY CONTEXT (from second brain):\n${pack.block}`;
          augmented = true;
        }
      } catch {
        // Country context is best-effort; do not fail the blueprint if it errors.
      }
    }

    // ── If we truly have nothing, return a structured assist payload ──
    if (combinedBrief.length < 40 && !countryBlock) {
      return {
        status: "needs_more_brief" as const,
        missing: ["A clear decision, audience hint, or uploaded source material."],
        suggestions: [
          "What decision must this research inform, and by when?",
          "Which 2-3 audiences do you already suspect matter most?",
          "What do you believe today that this study could confirm or falsify?",
          "Which geographies, sectors, or channels are in scope?",
        ],
      };
    }

    const system =
      "You are a McKinsey-grade sovereign research director. Given a country and a committed program brief, "
      + "design the full research plan: WHO to hear from (segments, with a recommended persona count 4-12 each) "
      + "and WHAT studies to run (survey / focus_group / creative_test), so that the plan is decision-useful for a Cabinet. "
      + "When the brief is terse, ground yourself in the COUNTRY CONTEXT block (sectors, KPIs, ministries, signals) to propose a defensible plan — never refuse. "
      + "Segments must be coherent populations a Cabinet can act on. Each study must target one named segment and answer a clear objective. "
      + "Return strict JSON only.";

    const user = `COUNTRY: ${row.country_code}
PROGRAM: ${row.title}

COMMITTED BRIEF:
${combinedBrief || "(brief is terse — rely on COUNTRY CONTEXT below)"}${countryBlock}

Return JSON of this exact shape:
{
  "summary": "2-3 sentence executive read-out of the plan",
  "segments": [
    {
      "label": "3-6 word segment name",
      "prompt": "1-2 sentence brief the persona generator will use",
      "size": 4-12,
      "rationale": "why this segment matters for this decision",
      "priority": 1-5
    }
  ],
  "studies": [
    {
      "segment_label": "exact matching segment label",
      "kind": "survey|focus_group|creative_test",
      "title": "study title",
      "objective": "1-2 sentence objective the study must answer"
    }
  ]
}
Rules:
- 3-6 segments; do NOT invent audiences the brief or country context do not warrant.
- 1-2 studies per segment; total 4-12 studies.
- Study kinds: survey for scale/attitude/tracking; focus_group for exploration; creative_test for messaging/creative.
- Every study.segment_label MUST exactly match one segments[].label.`;

    let content = "";
    try { content = await callGateway(system, user, MODEL_PRIMARY); }
    catch { content = await callGateway(system, user, MODEL_FALLBACK); }

    const rawJson = safeJson<unknown>(content);
    const blueprint = coerceBlueprint(rawJson);
    if (!blueprint) throw new Error("AI returned an unusable blueprint — try Regenerate.");

    // Rebind orphan study.segment_label to nearest segment label.
    const labels = new Set(blueprint.segments.map((s) => s.label));
    for (const s of blueprint.studies) {
      if (!labels.has(s.segment_label)) {
        s.segment_label = blueprint.segments[0]?.label ?? s.segment_label;
      }
    }

    const { error: upErr } = await supabase
      .from("persona_projects")
      .update({
        blueprint_proposal: blueprint as unknown as Json,
        blueprint_generated_at: new Date().toISOString(),
        // Regenerating always resets committed state.
        blueprint_committed_at: null,
      } as never)
      .eq("id", data.projectId);
    if (upErr) throw new Error(upErr.message);

    return { status: "ok" as const, blueprint, generatedAt: new Date().toISOString(), augmented };
  });

// ── AI-assisted brief additions (used by the Blueprint "assist me" UI) ────
export const suggestBriefAdditions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("persona_projects")
      .select("id,title,country_code,brief_raw")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research program not found");

    let countryBlock = "";
    try {
      const { buildCountryContextPack } = await import("./context-pack.server");
      const pack = await buildCountryContextPack(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context.supabase as unknown as any,
        row.country_code as string,
        String(row.title ?? ""),
      );
      if (pack?.block) countryBlock = `\n\nCOUNTRY CONTEXT:\n${pack.block}`;
    } catch { /* best effort */ }

    const system =
      "You are a McKinsey engagement partner helping a sovereign client sharpen a research brief. "
      + "Draft a concise 6-10 sentence brief-addition the admin can accept as-is. "
      + "Anchor on the country context when the raw brief is terse. Prose only, no JSON.";
    const user = `PROGRAM: ${row.title}
COUNTRY: ${row.country_code}
RAW BRIEF SO FAR:
${(row.brief_raw ?? "").toString().slice(0, 2000) || "(empty)"}${countryBlock}

Write a brief-addition that names: the decision, the audiences, the hypotheses, the timeframe, and the success criteria. Keep it specific to this country and program.`;

    let content = "";
    try { content = await callGateway(system, user, MODEL_PRIMARY); }
    catch { content = await callGateway(system, user, MODEL_FALLBACK); }
    // Model may still wrap in JSON despite instructions — strip if so.
    const text = content.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
    return { text };
  });

// ── Save edits ────────────────────────────────────────────────────────────
export const saveBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), blueprint: BlueprintSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_projects")
      .update({ blueprint_proposal: data.blueprint as unknown as Json } as never)
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Approve (atomic) ──────────────────────────────────────────────────────
// Records approval only. Segment persona generation and study composition
// then run client-side via the existing generateSegment / autorun pipeline,
// so a single long AI chain never blocks the server-function boundary.
export const approveBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), blueprint: BlueprintSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_projects")
      .update({
        blueprint_proposal: data.blueprint as unknown as Json,
        blueprint_committed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true as const, committedAt: new Date().toISOString() };
  });

// ── Server-side guard usable from other server fns ────────────────────────
export async function assertBlueprintCommitted(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  projectId: string,
) {
  const { data, error } = await supabase
    .from("persona_projects")
    .select("blueprint_committed_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.blueprint_committed_at) {
    throw new Error("Approve the research blueprint before generating segments or studies.");
  }
}
