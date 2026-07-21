// Chamber 07 · Stage 02 AI Composer — proposes segments automatically from brief + personas.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";

const ComposeInput = z.object({
  countryCode: z.string().min(3).max(4),
  projectId: z.string().min(1),
  count: z.number().int().min(2).max(6).default(3),
});

export type SegmentProposal = {
  label: string;
  prompt: string;
  size: number;
  rationale: string;
  evidence: Array<{ quote: string; source: string }>;
};

export type ComposeSegmentsResult =
  | { ok: true; proposals: SegmentProposal[]; model: string }
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
        temperature: 0.5,
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

export const composeSegments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ComposeInput.parse(d))
  .handler(async ({ data, context }): Promise<ComposeSegmentsResult> => {
    const { supabase } = context;
    const code = data.countryCode;
    const projectId = data.projectId;

    const { data: project, error: projectErr } = await supabase
      .from("persona_projects")
      .select("id")
      .eq("id", projectId)
      .eq("country_code", code)
      .maybeSingle();
    if (projectErr) throw new Error(projectErr.message);
    if (!project) return { ok: false, reason: "Research program not found for this country." };
    const { assertProgramBriefCommitted } = await import("./project-brief.functions");
    await assertProgramBriefCommitted(supabase, projectId);

    // Existing segments — avoid duplicates inside this program only.
    const { data: existingSegs } = await supabase
      .from("persona_segments")
      .select("label,prompt")
      .eq("country_code", code)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(24);

    // Active brief / blueprint
    const { data: draft } = await supabase
      .from("persona_study_drafts")
      .select("brief_raw,brief_scope,outcome_blueprint")
      .eq("country_code", code)
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Personas snapshot (archetype spread)
    const { data: personas } = await supabase
      .from("personas")
      .select("archetype,name")
      .eq("country_code", code)
      .limit(60);

    const scope = (draft?.brief_scope ?? null) as {
      title?: string;
      objectives?: string[];
      audiences?: string[];
    } | null;
    const blueprint = (draft?.outcome_blueprint ?? null) as {
      deliverables?: Array<{ label?: string }>;
    } | null;

    const briefBlock = [
      scope?.title ? `BRIEF TITLE: ${scope.title}` : "",
      scope?.objectives?.length
        ? `OBJECTIVES:\n- ${scope.objectives.slice(0, 6).join("\n- ")}`
        : "",
      scope?.audiences?.length ? `TARGET AUDIENCES: ${scope.audiences.slice(0, 8).join(", ")}` : "",
      blueprint?.deliverables?.length
        ? `DELIVERABLES: ${blueprint.deliverables.map((d) => d?.label).filter(Boolean).slice(0, 6).join(", ")}`
        : "",
      draft?.brief_raw ? `BRIEF RAW: ${String(draft.brief_raw).slice(0, 1000)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const existingBlock =
      (existingSegs ?? []).map((s) => `- ${s.label}`).join("\n") || "(none)";
    const personaBlock =
      (personas ?? [])
        .map((p) => p.archetype || p.name)
        .filter(Boolean)
        .slice(0, 30)
        .join(", ") || "(no personas yet)";

    const system =
      "You are a McKinsey-grade research director for a sovereign cabinet. " +
      "Propose distinct, decision-useful audience SEGMENTS to hear from next. " +
      "Each segment must be a coherent population a Cabinet can act on — not a persona, not a topic. " +
      "Avoid duplicating existing segments. Return strict JSON.";

    const user = `COUNTRY: ${code}

ACTIVE BRIEF:
${briefBlock || "(no active brief captured — infer from country signal)"}

EXISTING SEGMENTS (do NOT duplicate):
${existingBlock}

EXISTING PERSONA ARCHETYPES:
${personaBlock}

Return JSON with this exact shape:
{
  "proposals": [
    {
      "label": "4-80 char segment name (a population, e.g. 'Coastal tourism operators')",
      "prompt": "20-400 char plain-English description of who to draft — demographics, geography, role, sentiment",
      "size": 6-12,
      "rationale": "1-2 sentences: why this segment matters to the brief now",
      "evidence": [{"quote": "short evidence from brief/country", "source": "brief|country|archetypes"}]
    }
  ]
}

Rules:
- Propose exactly ${data.count} segments.
- Segments must be materially different from each other AND from EXISTING SEGMENTS.
- Ground each in the brief; if brief is thin, ground in the country's real GDP-elevation stakes.`;

    const attempt = async (extra?: string): Promise<ComposeSegmentsResult> => {
      const raw = await callGateway(system, extra ? `${user}\n\nCORRECTION: ${extra}` : user);
      const parsed = parseJson<{
        proposals?: Array<{
          label?: string;
          prompt?: string;
          size?: number;
          rationale?: string;
          evidence?: Array<{ quote?: string; source?: string }>;
        }>;
      }>(raw);
      if (!parsed?.proposals?.length) return { ok: false, reason: "AI returned no proposals." };

      const existingLabels = new Set(
        (existingSegs ?? []).map((s) => s.label.trim().toLowerCase()),
      );
      const seen = new Set<string>();
      const proposals: SegmentProposal[] = [];
      for (const p of parsed.proposals) {
        const label = clampStr(p.label, 4, 80);
        const prompt = clampStr(p.prompt, 20, 400);
        if (!label || !prompt) continue;
        const key = label.toLowerCase();
        if (existingLabels.has(key) || seen.has(key)) continue;
        seen.add(key);
        const size = Math.max(3, Math.min(20, Number(p.size) || 8));
        const evidence = (p.evidence ?? [])
          .slice(0, 4)
          .map((e) => ({
            quote: String(e?.quote ?? "").slice(0, 220),
            source: String(e?.source ?? "").slice(0, 60),
          }))
          .filter((e) => e.quote.length > 0);
        proposals.push({
          label,
          prompt,
          size,
          rationale: String(p.rationale ?? "").slice(0, 400),
          evidence,
        });
      }

      if (proposals.length === 0) {
        return { ok: false, reason: "All proposals were duplicates or malformed." };
      }
      return { ok: true, proposals, model: MODEL };
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
