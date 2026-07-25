// @domain personas
// @tables persona_projects,persona_segment_members,persona_segments,personas
// @ui src/components/personas/StudioStepper.tsx; src/components/personas/StudyWizard/BlueprintReview.tsx; src/routes/_authenticated/admin/countries.$code.personas.$id.tsx

// Chamber 07 · Persona + segment generation server functions.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCountryContextPack, type ContextCitation } from "./context-pack.server";
import {
  hasAnyCitableCitation,
  refsFromTextAndModel,
  sanitizeCitationMarkersInText,
  sanitizeJsonCitationMarkers,
  validCitationsForRefs,
} from "@/lib/citations/hygiene";
import type { Json } from "@/integrations/supabase/types";

const GEN_MODEL = "google/gemini-2.5-pro";
const FAST_MODEL = "google/gemini-2.5-flash";

type PersonaListRow = {
  id: string;
  name: string;
  archetype: string | null;
  summary: string | null;
  visibility: string;
  origin: string;
  created_at: string;
  attributes: Json;
  grounding_refs: Json;
  citations: Json;
};

async function callGateway(system: string, user: string, model = GEN_MODEL): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "{}";
}

function safeParse<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {}
    }
    return null;
  }
}

function fullCitationsForRefs(citations: ContextCitation[], refs: unknown): ContextCitation[] {
  return validCitationsForRefs(citations, refs);
}

function hasUsableCitationMetadata(citations: unknown): boolean {
  return hasAnyCitableCitation(citations);
}

// ── Generate a single persona ─────────────────────────────────────────────
const GenPersonaInput = z.object({
  countryCode: z.string().min(3).max(4),
  brief: z.string().min(3).max(500),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const generatePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenPersonaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pack = await buildCountryContextPack(supabase, data.countryCode, data.brief);
    const raw = await callGateway(
      "You design vivid, non-average synthetic personas for sovereign market research. Ground every trait in the provided country context. Cite facts using [N] markers matching the context list. Return strict JSON only.",
      `Design ONE persona for the following brief: "${data.brief}"

${pack.block}

Return JSON:
{
  "name": "First Last",
  "archetype": "short label, e.g. 'CBI applicant · European HNWI'",
  "summary": "3-4 sentence rich portrait citing [N] context refs",
  "attributes": {
    "age": 42,
    "gender": "…",
    "location": "…",
    "income_bracket": "…",
    "education": "…",
    "occupation": "…",
    "family": "…",
    "values": ["…","…"],
    "motivations": ["…","…"],
    "frustrations": ["…","…"],
    "media_habits": ["…"],
    "decision_style": "…",
    "brand_affinities": ["…"],
    "political_leaning": "…"
  },
  "ocean": { "openness": 0.0-1.0, "conscientiousness": 0.0-1.0, "extraversion": 0.0-1.0, "agreeableness": 0.0-1.0, "neuroticism": 0.0-1.0 },
  "grounding_refs": [1,3,5]
}`,
    );
    const parsed = safeParse<Record<string, unknown>>(raw);
    if (!parsed || typeof parsed.name !== "string") {
      throw new Error("AI returned no usable persona — try Regenerate.");
    }

    const rawSummary = parsed.summary ? String(parsed.summary).slice(0, 2000) : null;
    const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(rawSummary, parsed.grounding_refs));
    const summary = rawSummary ? sanitizeCitationMarkersInText(rawSummary, citations) : null;

    const { data: row, error } = await supabase
      .from("personas")
      .insert({
        country_code: data.countryCode,
        name: String(parsed.name).slice(0, 120),
        archetype: parsed.archetype ? String(parsed.archetype).slice(0, 120) : null,
        summary,
        attributes: sanitizeJsonCitationMarkers(parsed.attributes ?? {}, citations) as never,
        ocean: (parsed.ocean ?? {}) as never,
        grounding_refs: ((Array.isArray(parsed.grounding_refs) ? parsed.grounding_refs : []) as never),
        citations: citations as never,
        origin: "ai",
        visibility: data.visibility,
        owner_user_id: userId,
        owner_country_code: data.visibility === "private" ? data.countryCode : null,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { persona: row, citations: pack.citations };
  });

// ── Generate a segment (N distinct personas) ──────────────────────────────
const GenSegmentInput = z.object({
  countryCode: z.string().min(3).max(4),
  projectId: z.string().min(1),
  prompt: z.string().min(3).max(500),
  size: z.number().int().min(3).max(20).default(8),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const generateSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenSegmentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error: projectErr } = await supabase
      .from("persona_projects")
      .select("id")
      .eq("id", data.projectId)
      .eq("country_code", data.countryCode)
      .maybeSingle();
    if (projectErr) throw new Error(projectErr.message);
    if (!project) throw new Error("Research program not found for this country.");
    const { assertProgramBriefCommitted } = await import("./project-brief.functions");
    await assertProgramBriefCommitted(supabase, data.projectId);

    const pack = await buildCountryContextPack(supabase, data.countryCode, data.prompt);

    const raw = await callGateway(
      "You generate REALISTIC, DIVERGENT populations of synthetic personas — never a consensus blob. Each persona must be materially different from the others (values, occupation, life-stage, sentiment). Ground in the country context; cite [N] refs. Return strict JSON.",
      `Generate a segment of ${data.size} unique personas matching: "${data.prompt}"

${pack.block}

Return JSON:
{
  "label": "3-6 word segment title",
  "distribution": { "age": "…", "income": "…", "notes": "…" },
  "personas": [
    { "name":"…", "archetype":"…", "summary":"1-2 sentences citing [N]", "attributes":{...brief}, "ocean":{...}, "grounding_refs":[N,...] }
  ]
}
Rules: exactly ${data.size} personas, all distinct, realistic distribution.`,
    );
    const parsed = safeParse<{ label?: string; distribution?: unknown; personas?: Array<Record<string, unknown>> }>(raw);
    if (!parsed?.personas?.length) throw new Error("AI returned no personas — try Regenerate.");

    const { data: seg, error: segErr } = await supabase
      .from("persona_segments")
      .insert({
        country_code: data.countryCode,
        project_id: data.projectId,
        label: String(parsed.label ?? data.prompt.slice(0, 60)).slice(0, 120),
        prompt: data.prompt,
        distribution: (parsed.distribution ?? {}) as never,
        size: parsed.personas.length,
        visibility: data.visibility,
        owner_user_id: userId,
        owner_country_code: data.visibility === "private" ? data.countryCode : null,
        uploaded_by: userId,
      } as never)
      .select()
      .single();
    if (segErr) throw new Error(segErr.message);

    const rows = parsed.personas.slice(0, data.size).map((p) => {
      const rawSummary = p.summary ? String(p.summary).slice(0, 2000) : null;
      const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(rawSummary, p.grounding_refs));
      return {
        country_code: data.countryCode,
        name: String(p.name ?? "Unnamed").slice(0, 120),
        archetype: p.archetype ? String(p.archetype).slice(0, 120) : null,
        summary: rawSummary ? sanitizeCitationMarkersInText(rawSummary, citations) : null,
        attributes: sanitizeJsonCitationMarkers(p.attributes ?? {}, citations) as never,
        ocean: (p.ocean ?? {}) as never,
        grounding_refs: (Array.isArray(p.grounding_refs) ? p.grounding_refs : []) as never,
        citations: citations as never,
        origin: "ai" as const,
        visibility: data.visibility,
        owner_user_id: userId,
        owner_country_code: data.visibility === "private" ? data.countryCode : null,
        uploaded_by: userId,
      };
    });
    const { data: personaRows, error: pErr } = await supabase.from("personas").insert(rows).select("id");
    if (pErr) throw new Error(pErr.message);

    if (personaRows?.length) {
      await supabase
        .from("persona_segment_members")
        .insert(personaRows.map((r) => ({ segment_id: seg.id, persona_id: r.id })));
    }

    return { segment: seg, personaCount: personaRows?.length ?? 0, citations: pack.citations };
  });

// ── List personas / segments ──────────────────────────────────────────────
export const listPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ countryCode: z.string(), projectId: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let rows: PersonaListRow[] = [];

    if (data.projectId) {
      const { data: segments, error: segErr } = await context.supabase
        .from("persona_segments")
        .select("id")
        .eq("country_code", data.countryCode)
        .eq("project_id", data.projectId)
        .limit(500);
      if (segErr) throw new Error(segErr.message);
      const segmentIds = (segments ?? []).map((s) => s.id as string);
      if (segmentIds.length === 0) return [];

      const { data: members, error: memberErr } = await context.supabase
        .from("persona_segment_members")
        .select(
          "segment_id, personas(id,name,archetype,summary,visibility,origin,created_at,attributes,grounding_refs,citations,country_code)",
        )
        .in("segment_id", segmentIds)
        .limit(500);
      if (memberErr) throw new Error(memberErr.message);

      const seen = new Set<string>();
      rows = (members ?? [])
        .flatMap((m) => {
          const p = (m as { personas: unknown }).personas;
          return Array.isArray(p) ? p : p ? [p] : [];
        })
        .filter((p): p is PersonaListRow & { country_code?: string } => {
          if (!p || typeof p !== "object") return false;
          const id = String((p as { id?: unknown }).id ?? "");
          const country = String((p as { country_code?: unknown }).country_code ?? "");
          if (!id || seen.has(id) || country !== data.countryCode) return false;
          seen.add(id);
          return true;
        })
        .map(({ country_code: _countryCode, ...p }) => p)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 200);
    } else {
      const { data: countryRows, error } = await context.supabase
        .from("personas")
        .select("id,name,archetype,summary,visibility,origin,created_at,attributes,grounding_refs,citations")
        .eq("country_code", data.countryCode)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      rows = countryRows ?? [];
    }
    const needsHydration = rows.some((row) => !hasUsableCitationMetadata(row.citations) && row.summary?.includes("["));
    if (!needsHydration) return rows;
    const pack = await buildCountryContextPack(context.supabase, data.countryCode);
    return rows.map((row) =>
      !hasUsableCitationMetadata(row.citations) && row.summary?.includes("[")
        ? { ...row, summary: sanitizeCitationMarkersInText(row.summary ?? "", fullCitationsForRefs(pack.citations, row.grounding_refs)), citations: fullCitationsForRefs(pack.citations, row.grounding_refs) }
        : row,
    );
  });

export const listSegments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string(), projectId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("persona_segments")
      .select("id,project_id,label,prompt,size,visibility,created_at")
      .eq("country_code", data.countryCode)
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("personas")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row && !hasUsableCitationMetadata(row.citations) && row.summary?.includes("[")) {
      const pack = await buildCountryContextPack(context.supabase, row.country_code, row.summary);
      const citations = fullCitationsForRefs(pack.citations, row.grounding_refs);
      return { ...row, summary: row.summary ? sanitizeCitationMarkersInText(row.summary, citations) : row.summary, citations };
    }
    return row;
  });

export const getSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: seg, error } = await context.supabase
      .from("persona_segments")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: members } = await context.supabase
      .from("persona_segment_members")
      .select("persona_id, personas(id,name,archetype,summary,attributes,grounding_refs,citations)")
      .eq("segment_id", data.id);
    const personas = (members ?? [])
      .flatMap((m) => {
        const p = (m as { personas: unknown }).personas;
        return Array.isArray(p) ? p : p ? [p] : [];
      })
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
    const pack = seg && personas.some((p) => !hasUsableCitationMetadata(p.citations) && String(p.summary ?? "").includes("["))
      ? await buildCountryContextPack(context.supabase, seg.country_code)
      : null;
    return {
      segment: seg,
      personas: personas.map((p) => {
        const citations = pack && !hasUsableCitationMetadata(p.citations) && String(p.summary ?? "").includes("[")
          ? fullCitationsForRefs(pack.citations, p.grounding_refs)
          : p.citations ?? [];
        const summary = p.summary ? sanitizeCitationMarkersInText(String(p.summary), citations as ContextCitation[]) : null;
        return { id: String(p.id ?? ""), name: String(p.name ?? ""), archetype: (p.archetype as string | null) ?? null, summary, citations };
      }),
    };
  });

export const deletePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("personas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("persona_segments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { FAST_MODEL, GEN_MODEL };
