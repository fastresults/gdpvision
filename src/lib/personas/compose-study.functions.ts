// Chamber 07 · Stage 03 AI Composer — picks segment + method + framing automatically.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";
const KINDS = ["survey", "focus_group", "creative_test"] as const;
type Kind = (typeof KINDS)[number];

const ComposeInput = z.object({ countryCode: z.string(), projectId: z.string().min(1) });
const ComposeForSegmentInput = z.object({
  countryCode: z.string(),
  segmentId: z.string(),
  projectId: z.string().min(1),
});

export type ComposeStudyResult =
  | {
      ok: true;
      segmentId: string;
      segmentLabel: string;
      kind: Kind;
      title: string;
      objective: string;
      rationale: string;
      evidence: Array<{ quote: string; source: string }>;
      model: string;
    }
  | { ok: false; reason: string };

async function callGateway(system: string, user: string, timeoutMs = 45_000): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 240)}`);
    }
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return j.choices?.[0]?.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clampStr(s: unknown, min: number, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (t.length < min) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export const composeStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ComposeInput.parse(d))
  .handler(async ({ data, context }): Promise<ComposeStudyResult> => {
    const { supabase } = context;
    const code = data.countryCode;
    const projectId = data.projectId;
    const { assertProgramBriefCommitted } = await import("./project-brief.functions");
    await assertProgramBriefCommitted(supabase, projectId);


    // 1. Load segments
    const { data: segments, error: segErr } = await supabase
      .from("persona_segments")
      .select("id,label,prompt,size,visibility")
      .eq("country_code", code)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(24);
    if (segErr) throw new Error(segErr.message);
    if (!segments || segments.length === 0) {
      return { ok: false, reason: "No segments yet — create one first." };
    }

    // 2. Load recent brief/blueprint context — scoped to the active project
    // when provided so proposals never leak from another program.
    let draftQ = supabase
      .from("persona_study_drafts")
      .select("brief_raw,brief_scope,outcome_blueprint")
      .eq("country_code", code)
      .order("updated_at", { ascending: false })
      .limit(1);
    draftQ = draftQ.eq("project_id", projectId);
    const { data: draft } = await draftQ.maybeSingle();

    // 3. Load recent studies to avoid duplication — scoped to project.
    let priorQ = supabase
      .from("studies")
      .select("title,kind,objective,segment_id")
      .eq("country_code", code)
      .order("created_at", { ascending: false })
      .limit(10);
    priorQ = priorQ.eq("project_id", projectId);
    const { data: priorStudies } = await priorQ;

    const scope = (draft?.brief_scope ?? null) as { title?: string; objectives?: string[] } | null;
    const blueprint = (draft?.outcome_blueprint ?? null) as {
      deliverables?: Array<{ label?: string }>;
    } | null;

    const segBlock = segments
      .map(
        (s, i) =>
          `#${i + 1}  id=${s.id}  size=${s.size}  label="${s.label}"  prompt="${(s.prompt ?? "").slice(0, 220)}"`,
      )
      .join("\n");

    const priorBlock = (priorStudies ?? [])
      .map((p) => `- [${p.kind}] ${p.title}${p.objective ? ` — ${p.objective.slice(0, 100)}` : ""}`)
      .join("\n") || "(none)";

    const briefBlock = [
      scope?.title ? `BRIEF TITLE: ${scope.title}` : "",
      scope?.objectives?.length ? `OBJECTIVES:\n- ${scope.objectives.slice(0, 5).join("\n- ")}` : "",
      blueprint?.deliverables?.length
        ? `DELIVERABLES: ${blueprint.deliverables.map((d) => d?.label).filter(Boolean).slice(0, 6).join(", ")}`
        : "",
      draft?.brief_raw ? `BRIEF RAW: ${String(draft.brief_raw).slice(0, 800)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const system =
      "You are a McKinsey-grade research director for a sovereign cabinet. " +
      "Given available persona segments and the country's active brief, pick the SINGLE highest-value study to run next. " +
      "Choose one segment_id from the list, one method, and frame a decision-oriented title and objective. " +
      "Do not repeat prior studies. Return strict JSON.";

    const user = `COUNTRY: ${code}

AVAILABLE SEGMENTS:
${segBlock}

ACTIVE BRIEF:
${briefBlock || "(no active brief captured — infer from segments)"}

PRIOR STUDIES:
${priorBlock}

Return JSON with this exact shape:
{
  "segment_id": "<one id from AVAILABLE SEGMENTS>",
  "kind": "survey" | "focus_group" | "creative_test",
  "title": "6-90 char decision-oriented title",
  "objective": "20-240 chars — the decision this informs",
  "rationale": "1-2 sentences: why this segment + method now",
  "evidence": [{"quote": "short evidence from brief/segment", "source": "brief|segment|prior"}]
}

Method guidance:
- survey → size sentiment, compare options, benchmark
- focus_group → hear objections, understand language, explore nuance
- creative_test → pressure-test a specific message or asset`;

    const attempt = async (extra?: string): Promise<ComposeStudyResult> => {
      const raw = await callGateway(system, extra ? `${user}\n\nCORRECTION: ${extra}` : user);
      const parsed = parseJson<{
        segment_id?: string;
        kind?: string;
        title?: string;
        objective?: string;
        rationale?: string;
        evidence?: Array<{ quote?: string; source?: string }>;
      }>(raw);
      if (!parsed) return { ok: false, reason: "AI returned unparseable JSON." };

      const seg = segments.find((s) => s.id === parsed.segment_id);
      if (!seg) return { ok: false, reason: "AI picked an unknown segment_id." };

      const kind = KINDS.includes(parsed.kind as Kind) ? (parsed.kind as Kind) : null;
      if (!kind) return { ok: false, reason: "AI picked an invalid method." };

      const title = clampStr(parsed.title, 6, 90);
      const objective = clampStr(parsed.objective, 20, 240);
      if (!title) return { ok: false, reason: "AI title missing or too short." };
      if (!objective) return { ok: false, reason: "AI objective missing or too short." };

      const evidence = (parsed.evidence ?? [])
        .slice(0, 4)
        .map((e) => ({
          quote: String(e?.quote ?? "").slice(0, 220),
          source: String(e?.source ?? "").slice(0, 60),
        }))
        .filter((e) => e.quote.length > 0);

      return {
        ok: true,
        segmentId: seg.id,
        segmentLabel: seg.label,
        kind,
        title,
        objective,
        rationale: String(parsed.rationale ?? "").slice(0, 400),
        evidence,
        model: MODEL,
      };
    };

    try {
      const first = await attempt();
      if (first.ok) return first;
      const second = await attempt(first.reason);
      return second;
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  });

// ── Per-segment composer (auto-run driver) ────────────────────────────────
// Given a specific segmentId, pick method + framing scoped to that audience.
export const composeStudyForSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ComposeForSegmentInput.parse(d))
  .handler(async ({ data, context }): Promise<ComposeStudyResult> => {
    const { supabase } = context;
    const code = data.countryCode;
    const projectId = data.projectId;

    const { data: seg, error: segErr } = await supabase
      .from("persona_segments")
      .select("id,label,prompt,size")
      .eq("id", data.segmentId)
      .eq("country_code", code)
      .eq("project_id", projectId)
      .maybeSingle();
    if (segErr) throw new Error(segErr.message);
    if (!seg) return { ok: false, reason: "Segment not found." };

    let draftQ = supabase
      .from("persona_study_drafts")
      .select("brief_raw,brief_scope,outcome_blueprint")
      .eq("country_code", code)
      .order("updated_at", { ascending: false })
      .limit(1);
    draftQ = draftQ.eq("project_id", projectId);
    const { data: draft } = await draftQ.maybeSingle();

    let priorQ = supabase
      .from("studies")
      .select("title,kind,objective")
      .eq("country_code", code)
      .order("created_at", { ascending: false })
      .limit(10);
    priorQ = priorQ.eq("project_id", projectId);
    const { data: priorStudies } = await priorQ;

    const scope = (draft?.brief_scope ?? null) as { title?: string; objectives?: string[] } | null;
    const blueprint = (draft?.outcome_blueprint ?? null) as {
      deliverables?: Array<{ label?: string }>;
    } | null;

    const priorBlock =
      (priorStudies ?? [])
        .map((p) => `- [${p.kind}] ${p.title}${p.objective ? ` — ${p.objective.slice(0, 100)}` : ""}`)
        .join("\n") || "(none)";

    const briefBlock = [
      scope?.title ? `BRIEF TITLE: ${scope.title}` : "",
      scope?.objectives?.length ? `OBJECTIVES:\n- ${scope.objectives.slice(0, 5).join("\n- ")}` : "",
      blueprint?.deliverables?.length
        ? `DELIVERABLES: ${blueprint.deliverables.map((d) => d?.label).filter(Boolean).slice(0, 6).join(", ")}`
        : "",
      draft?.brief_raw ? `BRIEF RAW: ${String(draft.brief_raw).slice(0, 800)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const system =
      "You are a McKinsey-grade research director for a sovereign cabinet. " +
      "For the GIVEN audience segment, choose the single highest-value study to run. " +
      "Pick one method and frame a decision-oriented title and objective. Return strict JSON.";

    const user = `COUNTRY: ${code}

TARGET SEGMENT (fixed — do not swap):
id=${seg.id}
label="${seg.label}"
size=${seg.size}
prompt="${(seg.prompt ?? "").slice(0, 240)}"

ACTIVE BRIEF:
${briefBlock || "(no active brief captured — infer from segment)"}

PRIOR STUDIES (avoid duplicating):
${priorBlock}

Return JSON with this exact shape:
{
  "kind": "survey" | "focus_group" | "creative_test",
  "title": "6-90 char decision-oriented title tailored to the segment",
  "objective": "20-240 chars — the decision this informs",
  "rationale": "1-2 sentences: why this method for this segment now",
  "evidence": [{"quote": "short evidence from brief/segment", "source": "brief|segment|prior"}]
}

Method guidance:
- survey → size sentiment, compare options, benchmark
- focus_group → hear objections, understand language, explore nuance
- creative_test → pressure-test a specific message or asset`;

    const attempt = async (extra?: string): Promise<ComposeStudyResult> => {
      const raw = await callGateway(system, extra ? `${user}\n\nCORRECTION: ${extra}` : user);
      const parsed = parseJson<{
        kind?: string;
        title?: string;
        objective?: string;
        rationale?: string;
        evidence?: Array<{ quote?: string; source?: string }>;
      }>(raw);
      if (!parsed) return { ok: false, reason: "AI returned unparseable JSON." };

      const kind = KINDS.includes(parsed.kind as Kind) ? (parsed.kind as Kind) : null;
      if (!kind) return { ok: false, reason: "AI picked an invalid method." };

      const title = clampStr(parsed.title, 6, 90);
      const objective = clampStr(parsed.objective, 20, 240);
      if (!title) return { ok: false, reason: "AI title missing or too short." };
      if (!objective) return { ok: false, reason: "AI objective missing or too short." };

      const evidence = (parsed.evidence ?? [])
        .slice(0, 4)
        .map((e) => ({
          quote: String(e?.quote ?? "").slice(0, 220),
          source: String(e?.source ?? "").slice(0, 60),
        }))
        .filter((e) => e.quote.length > 0);

      return {
        ok: true,
        segmentId: seg.id,
        segmentLabel: seg.label,
        kind,
        title,
        objective,
        rationale: String(parsed.rationale ?? "").slice(0, 400),
        evidence,
        model: MODEL,
      };
    };

    try {
      const first = await attempt();
      if (first.ok) return first;
      const second = await attempt(first.reason);
      return second;
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  });
