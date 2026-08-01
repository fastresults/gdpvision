// @domain personas
// @tables persona_projects
// @ui src/components/personas/StudyWizard/BlueprintReview.tsx; src/components/personas/StudyWizard/ProgramBriefIntake.tsx; src/hooks/useProgramBriefGate.ts

// Chamber 07 · Program Brief — mandatory intake for every research program.
//
// A program brief is captured (typed / dictated / uploaded), enriched into a
// structured Research Scope by AI, then committed. Every downstream stage
// (segments, studies, auto-run) refuses to run until commit.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ResearchScope } from "./wizard.functions";

const AI_MODEL_PRIMARY = "google/gemini-3.5-flash";
const AI_MODEL_FALLBACK = "google/gemini-3.1-flash-lite";
const AI_TIMEOUT_MS = 45_000;

const UploadSchema = z.object({
  name: z.string(),
  path: z.string(),
  mime: z.string(),
  size: z.number(),
  excerpt: z.string().optional(),
});

type ProjectBriefRow = {
  id: string;
  title: string;
  country_code: string;
  brief_raw: string | null;
  brief_scope: Json | null;
  brief_uploads: Json | null;
  brief_committed_at: string | null;
};

// ── Public accessor ────────────────────────────────────────────────────────

export const getProjectBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("persona_projects")
      .select("id,title,country_code,brief_raw,brief_scope,brief_uploads,brief_committed_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research program not found");
    const r = row as unknown as ProjectBriefRow;
    return {
      id: r.id,
      title: r.title,
      countryCode: r.country_code,
      brief_raw: r.brief_raw ?? "",
      brief_scope: (r.brief_scope as unknown as ResearchScope | null) ?? null,
      brief_uploads: Array.isArray(r.brief_uploads) ? (r.brief_uploads as unknown as Array<z.infer<typeof UploadSchema>>) : [],
      committed_at: r.brief_committed_at,
    };
  });

// ── Autosave ───────────────────────────────────────────────────────────────

const SaveBriefInput = z.object({
  projectId: z.string().uuid(),
  brief_raw: z.string().max(40_000).optional(),
  brief_uploads: z.array(UploadSchema).max(20).optional(),
});

export const saveProjectBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveBriefInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.brief_raw !== undefined) patch.brief_raw = data.brief_raw;
    if (data.brief_uploads !== undefined) patch.brief_uploads = data.brief_uploads as unknown as Json;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await context.supabase
      .from("persona_projects")
      .update(patch as never)
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── AI enrichment ──────────────────────────────────────────────────────────

async function callGatewayJson(system: string, user: string, model: string): Promise<string> {
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
        { role: "system", content: `${system}\n\nReturn a single valid JSON object only.` },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 240)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("AI returned an empty response.");
  return content;
}

function safeParseJson<T>(s: string): T | null {
  const cleaned = s.replace(/```(?:json|JSON)?\s*/g, "").replace(/```\s*$/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch { /* try extract */ }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)) as T; } catch { /* noop */ }
  }
  return null;
}

function validScope(v: unknown): v is ResearchScope {
  return !!v && typeof v === "object"
    && typeof (v as ResearchScope).title === "string"
    && (v as ResearchScope).title.length > 0;
}

export const enrichProjectBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("persona_projects")
      .select("id,title,country_code,brief_raw,brief_uploads")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research program not found");
    const r = row as unknown as ProjectBriefRow;

    const raw = (r.brief_raw ?? "").trim();
    const uploads = Array.isArray(r.brief_uploads)
      ? (r.brief_uploads as unknown as Array<z.infer<typeof UploadSchema>>)
      : [];
    const uploadBlock = uploads
      .filter((u) => u.excerpt && u.excerpt.trim().length > 0)
      .map((u) => `\n\n[UPLOAD: ${u.name} (${u.mime})]\n${u.excerpt}`)
      .join("");
    const combined = `${raw}${uploadBlock}`.trim().slice(0, 20_000);
    if (combined.length < 40) {
      throw new Error("Add at least 40 characters of brief text (or an uploaded document) before enriching.");
    }

    const system = "You are a McKinsey engagement partner scoping a sovereign research study. Convert the client's raw brief into a rigorous Research Scope. Return strict JSON only.";
    const user = `Program title: ${r.title}\nCountry: ${r.country_code}\n\nRAW BRIEF (may be typed, transcribed from voice, or extracted from uploads):\n${combined}\n\nReturn JSON:\n{\n  "title": "\u2264 90 char headline for this program",\n  "objectives": ["3-6 crisp objectives"],\n  "hypotheses": ["3-5 falsifiable hypotheses"],\n  "decisions": ["decisions this research must inform, 2-4"],\n  "stakeholders": [{"name":"\u2026","type":"internal|external","role":"\u2026"}],\n  "timeframe": "when this must be delivered / time horizon",\n  "geography": "geographies in scope",\n  "sensitivities": ["political/reputational risks to handle carefully"],\n  "success_criteria": ["what 'done well' looks like, 3-5"]\n}`;

    let parsed: ResearchScope | null = null;
    let lastErr: unknown = null;
    for (const model of [AI_MODEL_PRIMARY, AI_MODEL_FALLBACK]) {
      try {
        const content = await callGatewayJson(system, user, model);
        const candidate = safeParseJson<unknown>(content);
        if (validScope(candidate)) {
          parsed = candidate;
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!parsed) {
      const msg = lastErr instanceof Error ? lastErr.message : "AI could not produce a valid scope.";
      throw new Error(msg);
    }

    const { error: updErr } = await context.supabase
      .from("persona_projects")
      .update({ brief_scope: parsed as unknown as Json } as never)
      .eq("id", data.projectId);
    if (updErr) throw new Error(updErr.message);

    return { scope: parsed };
  });

// ── Final commit ───────────────────────────────────────────────────────────

export const commitProjectBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("persona_projects")
      .select("brief_raw,brief_scope,brief_uploads,brief_committed_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research program not found");
    if (row.brief_committed_at) return { ok: true as const, alreadyCommitted: true };
    const raw = ((row as { brief_raw: string | null }).brief_raw ?? "").trim();
    const uploads = Array.isArray((row as { brief_uploads: unknown }).brief_uploads)
      ? ((row as { brief_uploads: Array<{ excerpt?: string }> }).brief_uploads)
      : [];
    const totalLen = raw.length + uploads.reduce((s, u) => s + (u.excerpt?.length ?? 0), 0);
    if (totalLen < 40) throw new Error("Brief is too short — add more detail or attach a source document before committing.");
    if (!row.brief_scope) throw new Error("Enrich the brief into a Research Scope before committing.");
    const { error: updErr } = await context.supabase
      .from("persona_projects")
      .update({ brief_committed_at: new Date().toISOString() } as never)
      .eq("id", data.projectId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true as const };
  });

// ── Reusable guard for other server fns ────────────────────────────────────
//
// Import and call this at the top of any server fn that runs research work
// against a specific research program. Throws when the program's brief has
// not been committed yet, so the AI never fires without knowing what to do.

export async function assertProgramBriefCommitted(
  supabase: unknown,
  projectId: string | null | undefined,
): Promise<void> {
  if (!projectId) return;
  const client = supabase as { from: (t: string) => unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (client.from("persona_projects") as any).select("brief_committed_at").eq("id", projectId).maybeSingle();
  const { data, error } = (await q) as { data: { brief_committed_at: string | null } | null; error: { message: string } | null };
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Research program not found");
  if (!data.brief_committed_at) {
    throw new Error("Program brief not committed — capture and confirm the brief before running research.");
  }
}

// ── Stage 00 · AI-first proposal ───────────────────────────────────────────
//
// The chamber leads with material, not with a naming field. Everything the
// admin dropped, dictated, pasted or linked is read in one pass and returned
// as a proposed programme: a Cabinet-recognisable title, a structured scope,
// a recommended instrument with its reason, and the questions the material
// does not answer. Nothing is written — the project is created afterwards.

export type ProgrammeProposal = {
  title: string;
  scope: ResearchScope;
  recommendedTrack: "synthetic" | "field" | "blended";
  trackReason: string;
  openQuestions: string[];
};

// Intake is two-tier: ONE governing source brief, N supporting context items.
// `uploads` is retained for older callers and is treated as context.
const ProposeInput = z.object({
  countryCode: z.string().min(2).max(4),
  raw: z.string().max(40_000).optional(),
  brief: UploadSchema.nullish(),
  context: z.array(UploadSchema).max(20).optional(),
  uploads: z.array(UploadSchema).max(20).optional(),
});

function validProposal(v: unknown): v is ProgrammeProposal {
  const p = v as ProgrammeProposal;
  return (
    !!p &&
    typeof p === "object" &&
    typeof p.title === "string" &&
    p.title.length > 0 &&
    validScope(p.scope) &&
    ["synthetic", "field", "blended"].includes(p.recommendedTrack)
  );
}

export const proposeProgrammeFromMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProposeInput.parse(d))
  .handler(async ({ data }) => {
    const raw = (data.raw ?? "").trim();
    const briefText =
      data.brief?.excerpt && data.brief.excerpt.trim().length > 0
        ? `[GOVERNING BRIEF: ${data.brief.name} (${data.brief.mime})]\n${data.brief.excerpt}`
        : "";
    const contextBlock = [...(data.context ?? []), ...(data.uploads ?? [])]
      .filter((u) => u.excerpt && u.excerpt.trim().length > 0)
      .map((u) => `\n\n[SUPPORTING CONTEXT: ${u.name} (${u.mime})]\n${u.excerpt}`)
      .join("");
    const combined = `${briefText}${raw ? `\n\n[PRINCIPAL'S OWN WORDS]\n${raw}` : ""}${contextBlock}`
      .trim()
      .slice(0, 30_000);
    if (combined.length < 40) {
      throw new Error("Add material first — type a line, dictate, drop a document or paste a link.");
    }

    const system =
      "You are a McKinsey engagement partner scoping a sovereign research programme for a national government. The client gives you ONE governing brief plus supporting context. The governing brief and the principal's own words decide the objectives, decisions, timeframe and geography; supporting context may only enrich, illustrate or qualify them — never override them. Where context contradicts the brief, keep the brief and raise the contradiction as an open question. Return strict JSON only.";
    const user = `Country: ${data.countryCode}

MATERIAL SUPPLIED BY THE CLIENT — the governing brief takes precedence over supporting context:
${combined}



Two instruments are available:
- "synthetic": AI casts a synthetic public from the national corpus and rehearses the conversation. Minutes. Directional, not defensible.
- "field": real participants, dated instruments, filed transcripts. Weeks. Citable evidence.
- "blended": rehearse synthetically first, then verify in the field.

Return JSON:
{
  "title": "\u2264 90 char Cabinet-recognisable programme name — the decision this research informs",
  "scope": {
    "title": "same as above",
    "objectives": ["3-6 crisp objectives"],
    "hypotheses": ["3-5 falsifiable hypotheses"],
    "decisions": ["decisions this research must inform, 2-4"],
    "stakeholders": [{"name":"\u2026","type":"internal|external","role":"\u2026"}],
    "timeframe": "when this must be delivered / time horizon",
    "geography": "geographies in scope",
    "sensitivities": ["political/reputational risks to handle carefully"],
    "success_criteria": ["what 'done well' looks like, 3-5"]
  },
  "recommendedTrack": "synthetic|field|blended",
  "trackReason": "one sentence, plain English, naming what in the material drove the choice",
  "openQuestions": ["3-5 questions the material does not answer"]
}`;

    let parsed: ProgrammeProposal | null = null;
    let lastErr: unknown = null;
    for (const model of [AI_MODEL_PRIMARY, AI_MODEL_FALLBACK]) {
      try {
        const content = await callGatewayJson(system, user, model);
        const candidate = safeParseJson<unknown>(content);
        if (validProposal(candidate)) {
          parsed = candidate;
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!parsed) {
      throw new Error(
        lastErr instanceof Error ? lastErr.message : "AI could not read that material into a programme.",
      );
    }
    return {
      ...parsed,
      title: parsed.title.slice(0, 120),
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.slice(0, 6) : [],
    };
  });
