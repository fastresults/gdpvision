// @domain personas
// @tables memory_objects,persona_chat_messages,persona_chats,persona_projects,persona_segment_members,persona_segments,persona_study_drafts,personas,studies,study_program_reports,study_questions,study_reports,study_responses,study_transcripts
// @ui src/components/personas/StudioStepper.tsx; src/components/personas/StudyWizard/ProgramSynthesisCard.tsx; src/routes/_authenticated/admin/countries.$code.personas.$id.tsx

// Chamber 07 · Studies (survey, focus group, creative test) + persona chat.

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { buildCountryContextPack, type ContextCitation } from "./context-pack.server";
import {
  hasAnyCitableCitation,
  refsFromTextAndModel,
  sanitizeCitationMarkersInText,
  sanitizeJsonCitationMarkers,
  validCitationsForRefs,
} from "@/lib/citations/hygiene";

const MODEL = "google/gemini-2.5-pro";
type AppSupabaseClient = SupabaseClient<Database>;

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

async function ai(system: string, user: string, json = true, temperature = 0.7): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  // Text-first read so an empty body (aborted upstream, truncated proxy)
  // resolves to "" rather than throwing "Unexpected end of JSON input".
  const text = (await res.text()).trim();
  if (!text) return "";
  let j: { choices?: Array<{ message?: { content?: string } }> } = {};
  try {
    j = JSON.parse(text);
  } catch {
    return "";
  }
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

function parseJson<T>(s: string): T | null {
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

// Strip any "FROM: McKinsey & Company" (and variants) that a model may
// have injected, along with an optional TO/RE header block that mimics it.
// Applied to every summary emitted or read back from `study_reports` /
// `study_program_reports` so the user-visible surface never leaks a
// third-party byline.
export function stripBrandedByline(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  // Full "FROM:" lines mentioning McKinsey/BCG/Bain/Deloitte/etc.
  s = s.replace(/^[ \t>*_#-]*from\s*[:—-].*?(mckinsey|bcg|bain|deloitte|kpmg|pwc|accenture|goldman)[^\n]*\n?/gim, "");
  // Bare "MCKINSEY & COMPANY" letterhead lines.
  s = s.replace(/^[ \t>*_#-]*(mckinsey\s*&\s*company|bcg|bain\s*&\s*company)[^\n]*\n?/gim, "");
  return s.trim();
}

// Latest active brief for a country (from persona_study_drafts). Used to
// ground per-study memos and the program-level portfolio synthesis.
export async function loadCountryBrief(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  countryCode: string,
  projectId?: string | null,
): Promise<{
  briefRaw: string | null;
  scope: { title?: string; objectives?: string[] } | null;
  blueprint: unknown | null;
  block: string;
}> {
  let draftQ = supabase
    .from("persona_study_drafts")
    .select("brief_raw,brief_scope,outcome_blueprint,updated_at")
    .eq("country_code", countryCode)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (projectId) draftQ = draftQ.eq("project_id", projectId);
  const { data: draft } = await draftQ.maybeSingle();
  const scope = (draft?.brief_scope ?? null) as { title?: string; objectives?: string[] } | null;
  const blueprint = draft?.outcome_blueprint ?? null;
  const briefRaw = (draft?.brief_raw as string | null) ?? null;
  const block = [
    scope?.title ? `BRIEF TITLE: ${scope.title}` : "",
    Array.isArray(scope?.objectives) && scope!.objectives!.length
      ? `BRIEF OBJECTIVES:\n- ${scope!.objectives!.slice(0, 8).map((s) => String(s).slice(0, 200)).join("\n- ")}`
      : "",
    blueprint ? `OUTCOME BLUEPRINT: ${JSON.stringify(blueprint).slice(0, 900)}` : "",
    briefRaw ? `BRIEF RAW: ${briefRaw.slice(0, 1500)}` : "",
  ].filter(Boolean).join("\n");
  return { briefRaw, scope, blueprint, block };
}

function fullCitationsForRefs(citations: ContextCitation[], refs: unknown): ContextCitation[] {
  return validCitationsForRefs(citations, refs);
}

function hasUsableCitationMetadata(citations: unknown): boolean {
  return hasAnyCitableCitation(citations);
}

function hydrateCitationField<T extends { citations?: unknown }>(row: T, sourceCitations: ContextCitation[]): T {
  return hasUsableCitationMetadata(row.citations)
    ? row
    : ({ ...row, citations: fullCitationsForRefs(sourceCitations, row.citations) } as T);
}

function personaBlock(p: { name: string; archetype?: string | null; summary?: string | null; attributes?: unknown; ocean?: unknown }): string {
  return [
    `NAME: ${p.name}`,
    p.archetype ? `ARCHETYPE: ${p.archetype}` : "",
    p.summary ? `SUMMARY: ${p.summary}` : "",
    p.attributes ? `ATTRIBUTES: ${JSON.stringify(p.attributes).slice(0, 800)}` : "",
    p.ocean ? `OCEAN: ${JSON.stringify(p.ocean)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Create study shell ────────────────────────────────────────────────────
const CreateStudyInput = z.object({
  countryCode: z.string(),
  projectId: z.string().optional(),
  segmentId: z.string(),
  kind: z.enum(["survey", "focus_group", "creative_test"]),
  title: z.string().min(3).max(160),
  objective: z.string().max(1200).optional(),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const createStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateStudyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const projectId = data.projectId ?? (await resolveDefaultProjectId(supabase, data.countryCode));
    if (!projectId) throw new Error("Select or create a research program before creating a study.");
    const { assertProgramBriefCommitted } = await import("./project-brief.functions");
    await assertProgramBriefCommitted(supabase, projectId);

    const { data: segment, error: segmentErr } = await supabase
      .from("persona_segments")
      .select("id,country_code,project_id")
      .eq("id", data.segmentId)
      .eq("country_code", data.countryCode)
      .eq("project_id", projectId)
      .maybeSingle();
    if (segmentErr) throw new Error(segmentErr.message);
    if (!segment) throw new Error("That segment belongs to another research program. Re-select a segment in this program.");

    // Idempotency guard: never create a duplicate draft for the same
    // (country, project, segment). Enforced at the DB level by a partial
    // unique index; this pre-check keeps
    // the happy path silent for auto-run races (StrictMode double-mount,
    // tab re-entry, retries).
    let existingQ = supabase
      .from("studies")
      .select("*")
      .eq("country_code", data.countryCode)
      .eq("segment_id", data.segmentId)
      .eq("status", "draft");
    if (projectId) existingQ = existingQ.eq("project_id", projectId);
    const { data: existing } = await existingQ.maybeSingle();
    if (existing) return existing;

    const { data: row, error } = await supabase
      .from("studies")
      .insert({
        country_code: data.countryCode,
        project_id: projectId,
        segment_id: data.segmentId,
        kind: data.kind,
        title: data.title,
        objective: data.objective ?? null,
        status: "draft",
        visibility: data.visibility,
        owner_user_id: userId,
        owner_country_code: data.visibility === "private" ? data.countryCode : null,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        let racedQ = supabase
          .from("studies")
          .select("*")
          .eq("country_code", data.countryCode)
          .eq("segment_id", data.segmentId)
          .eq("status", "draft");
        if (projectId) racedQ = racedQ.eq("project_id", projectId);
        const { data: raced } = await racedQ.maybeSingle();
        if (raced) return raced;
      }
      throw new Error(error.message);
    }
    return row;
  });

// ── AI-draft study questions ──────────────────────────────────────────────
export const draftStudyQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string(), count: z.number().int().min(3).max(20).default(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: study } = await supabase.from("studies").select("*").eq("id", data.studyId).maybeSingle();
    if (!study) throw new Error("Study not found");
    const { assertProgramBriefCommitted } = await import("./project-brief.functions");
    if (study.project_id) await assertProgramBriefCommitted(supabase, study.project_id as string);

    const pack = await buildCountryContextPack(supabase, study.country_code, study.objective ?? study.title);

    const raw = await ai(
      "You design rigorous market-research instruments (surveys, focus-group guides, creative-test protocols) for sovereign policy work. Non-leading, one idea per question, mix of scale + open. Return strict JSON.",
      `Draft ${data.count} questions for a ${study.kind} titled "${study.title}".
Objective: ${study.objective ?? "(none)"}
${pack.block}

Return JSON: { "questions": [ { "prompt": "…", "kind": "open|scale|choice", "options": ["…"] (only for choice/scale) } ] }`,
    );
    const parsed = parseJson<{ questions?: Array<{ prompt: string; kind: string; options?: string[] }> }>(raw);
    if (!parsed?.questions?.length) throw new Error("AI returned no questions.");

    // Replace existing questions
    await supabase.from("study_questions").delete().eq("study_id", data.studyId);
    const rows = parsed.questions.slice(0, data.count).map((q, i) => ({
      study_id: data.studyId,
      ord: i,
      prompt: sanitizeCitationMarkersInText(String(q.prompt).slice(0, 800), []),
      kind: (["open", "scale", "choice"].includes(q.kind) ? q.kind : "open") as string,
      options: sanitizeJsonCitationMarkers(q.options ?? [], []) as never,
    }));
    const { error } = await supabase.from("study_questions").insert(rows);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });

async function loadStudyWithPersonas(supabase: import("@supabase/supabase-js").SupabaseClient, studyId: string) {
  const { data: study } = await supabase.from("studies").select("*").eq("id", studyId).maybeSingle();
  if (!study) throw new Error("Study not found");
  if (study.segment_id && study.project_id) {
    const { data: segment } = await supabase
      .from("persona_segments")
      .select("id")
      .eq("id", study.segment_id)
      .eq("project_id", study.project_id)
      .maybeSingle();
    if (!segment) throw new Error("Study segment is outside this research program.");
  }
  const { data: questions } = await supabase.from("study_questions").select("*").eq("study_id", studyId).order("ord");
  const { data: members } = await supabase
    .from("persona_segment_members")
    .select("persona_id, personas(id,name,archetype,summary,attributes,ocean)")
    .eq("segment_id", study.segment_id);
  const personas = (members ?? [])
    .flatMap((m) => {
      const p = (m as { personas: unknown }).personas;
      return Array.isArray(p) ? p : p ? [p] : [];
    })
    .filter((x): x is Record<string, unknown> & { id: string; name: string } => !!x && typeof x === "object");
  return { study, questions: questions ?? [], personas };
}

// ── Run survey (batched per persona) ──────────────────────────────────────
// ── Phase A: generate persona responses / focus-group transcript ─────────
export const runStudyResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { study, questions, personas } = await loadStudyWithPersonas(supabase, data.studyId);
    const { assertProgramBriefCommitted } = await import("./project-brief.functions");
    if (study.project_id) await assertProgramBriefCommitted(supabase, study.project_id as string);
    if (!questions.length) throw new Error("No questions — draft them first.");
    if (!personas.length) throw new Error("Segment has no personas.");

    await supabase.from("studies").update({ status: "running" }).eq("id", data.studyId);
    await supabase.from("study_responses").delete().eq("study_id", data.studyId);
    await supabase.from("study_transcripts").delete().eq("study_id", data.studyId);
    await supabase.from("study_reports").delete().eq("study_id", data.studyId);

    const pack = await buildCountryContextPack(supabase, study.country_code, study.objective ?? study.title);
    const qBlock = questions.map((q, i) => `Q${i + 1} [${q.kind}] ${q.prompt}${q.options && Array.isArray(q.options) && (q.options as unknown[]).length ? ` (options: ${JSON.stringify(q.options)})` : ""}`).join("\n");

    if (study.kind === "survey" || study.kind === "creative_test") {
      for (const p of personas) {
        try {
          const raw = await ai(
            `You are ROLE-PLAYING a specific synthetic persona for market research. Answer AS that persona — voice, biases, language level. Ground reasoning in the country context. Cite [N].`,
            `PERSONA:\n${personaBlock(p as never)}\n\nCOUNTRY CONTEXT:\n${pack.block}\n\nSTUDY: ${study.title}\nOBJECTIVE: ${study.objective ?? "(none)"}\nQUESTIONS:\n${qBlock}\n\nReturn JSON: { "answers": [ { "q_ord": 0, "answer": "…", "rationale": "1 sentence", "citations": [N,...] } ] }`,
          );
          const parsed = parseJson<{ answers?: Array<{ q_ord: number; answer: unknown; rationale?: string; citations?: number[] }> }>(raw);
          if (!parsed?.answers) continue;
          const rows = parsed.answers
            .map((a) => {
              const q = questions[a.q_ord];
              if (!q) return null;
              const rawAnswer = a.answer ?? "";
              const markerText = `${typeof rawAnswer === "string" ? rawAnswer : JSON.stringify(rawAnswer)} ${a.rationale ?? ""}`;
              const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(markerText, a.citations));
              return {
                study_id: data.studyId,
                persona_id: p.id as string,
                question_id: q.id as string,
                answer: sanitizeJsonCitationMarkers(rawAnswer, citations) as never,
                rationale: a.rationale ? sanitizeCitationMarkersInText(String(a.rationale).slice(0, 800), citations) : null,
                citations: citations as never,
                model: MODEL,
              };
            })
            .filter((x): x is NonNullable<typeof x> => !!x);
          if (rows.length) await supabase.from("study_responses").insert(rows);
        } catch (e) {
          console.warn(`[persona ${(p as { id: string }).id}]`, (e as Error).message);
        }
      }
    } else if (study.kind === "focus_group") {
      const rosterBlock = personas.map((p, i) => `P${i + 1}. ${personaBlock(p as never)}`).join("\n\n");
      try {
        const raw = await ai(
          "You are a senior qualitative moderator generating a realistic focus-group transcript. Personas MUST disagree, interrupt, build on each other. No consensus. Ground in country context; cite [N].",
          `PERSONAS:\n${rosterBlock}\n\nCOUNTRY CONTEXT:\n${pack.block}\n\nOBJECTIVE: ${study.objective ?? study.title}\nDISCUSSION QUESTIONS:\n${qBlock}\n\nProduce a transcript. Return JSON: { "transcript": [ { "speaker": "moderator|P1|P2|…", "utterance": "…", "citations": [N,...] } ] } — at least 3 turns per persona, moderator opens each question.`,
        );
        const parsed = parseJson<{ transcript?: Array<{ speaker: string; utterance: string; citations?: number[] }> }>(raw);
        if (parsed?.transcript?.length) {
          const rows = parsed.transcript.map((t, i) => {
            const idx = /^P(\d+)$/.exec(t.speaker)?.[1];
            const persona = idx ? personas[Number(idx) - 1] : null;
            const rawUtterance = String(t.utterance).slice(0, 3000);
            const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(rawUtterance, t.citations));
            return {
              study_id: data.studyId,
              ord: i,
              speaker: String(t.speaker).slice(0, 40),
              persona_id: (persona as { id?: string } | null)?.id ?? null,
              utterance: sanitizeCitationMarkersInText(rawUtterance, citations),
              citations: citations as never,
            };
          });
          await supabase.from("study_transcripts").insert(rows);
        }
      } catch (e) {
        console.warn("[focus_group]", (e as Error).message);
      }
    }
    return { ok: true };
  });

// ── Phase B: synthesize the McKinsey-style report ────────────────────────
export const runStudySynthesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: study } = await supabase.from("studies").select("*").eq("id", data.studyId).maybeSingle();
    if (!study) throw new Error("Study not found");
    const { assertProgramBriefCommitted } = await import("./project-brief.functions");
    if (study.project_id) await assertProgramBriefCommitted(supabase, study.project_id as string);

    const [{ data: responses }, { data: transcript }, { data: questions }, { data: segment }, { count: personaCount }, { data: members }] = await Promise.all([
      supabase.from("study_responses").select("*, personas(name,archetype)").eq("study_id", data.studyId).limit(500),
      supabase.from("study_transcripts").select("*").eq("study_id", data.studyId).order("ord").limit(500),
      supabase.from("study_questions").select("ord,prompt,kind,options").eq("study_id", data.studyId).order("ord"),
      study.segment_id
        ? supabase.from("persona_segments").select("id,label,prompt").eq("id", study.segment_id).maybeSingle()
        : Promise.resolve({ data: null as { id: string; label: string; prompt: string | null } | null }),
      study.segment_id
        ? supabase.from("persona_segment_members").select("persona_id", { count: "exact", head: true }).eq("segment_id", study.segment_id)
        : Promise.resolve({ count: 0 }),
      study.segment_id
        ? supabase
            .from("persona_segment_members")
            .select("segment_id,personas(id,name,archetype,summary,attributes,ocean)")
            .eq("segment_id", study.segment_id)
        : Promise.resolve({ data: [] as Array<{ segment_id: string; personas: unknown }> }),
    ]);

    const pack = await buildCountryContextPack(supabase, study.country_code, study.objective ?? study.title);
    const brief = await loadCountryBrief(supabase, study.country_code, study.project_id as string | null);
    const dataBlock = study.kind === "focus_group"
      ? (transcript ?? []).map((t) => `${t.speaker}: ${t.utterance}`).join("\n").slice(0, 8000)
      : (responses ?? []).map((r) => {
          const persona = (r as { personas?: { name?: string; archetype?: string } | null }).personas;
          return `[${persona?.name ?? "?"} · ${persona?.archetype ?? ""}] ${JSON.stringify(r.answer).slice(0, 400)}${r.rationale ? ` — ${r.rationale}` : ""}`;
        }).join("\n").slice(0, 8000);

    const questionList = (questions ?? []).map((q) => ({
      ord: q.ord as number,
      prompt: String(q.prompt),
      kind: String(q.kind),
      options: Array.isArray(q.options) ? (q.options as unknown[]) : [],
    }));
    const personaRoster = (members ?? [])
      .flatMap((m) => {
        const p = (m as { personas: unknown }).personas;
        return Array.isArray(p) ? p : p ? [p] : [];
      })
      .filter((p): p is Record<string, unknown> & { id: string; name: string } => !!p && typeof p === "object")
      .map((p) => ({
        id: p.id,
        name: p.name,
        archetype: (p.archetype as string | null | undefined) ?? null,
        summary: (p.summary as string | null | undefined) ?? null,
        attributes: p.attributes ?? null,
        ocean: p.ocean ?? null,
      }));
    const methodology = {
      report_frame: {
        country_code: study.country_code as string,
        project_id: (study.project_id as string | null) ?? null,
        title: study.title as string,
        objective: (study.objective as string | null) ?? null,
        decision_question: brief.scope?.title ?? study.objective ?? study.title,
      },
      brief: {
        title: brief.scope?.title ?? null,
        objectives: brief.scope?.objectives ?? [],
        raw_excerpt: brief.briefRaw ? brief.briefRaw.slice(0, 1200) : null,
      },
      workflow: {
        cast: "Synthetic personas were generated from the committed brief and country corpus to represent materially different stakeholder voices.",
        group: "Personas were organized into a segment with a shared decision context, lived experience, and policy exposure.",
        rehearse: "The study instrument was run against the cast so each persona could respond in character before synthesis.",
      },
      segment: segment
        ? { id: segment.id, label: segment.label, prompt: segment.prompt ?? null, persona_count: personaRoster.length || personaCount || 0 }
        : null,
      personas: personaRoster,
      instrument: {
        kind: study.kind as string,
        title: study.title as string,
        objective: (study.objective as string | null) ?? null,
        questions: questionList,
      },
      limitations: [
        "Synthetic research is directional and should be treated as a fast empirical rehearsal, not a replacement for fieldwork.",
        "Findings are strongest where persona responses converge with cited country-context evidence.",
      ],
      generated_at: new Date().toISOString(),
    };
    const contextPayload = {
      instrument: {
        kind: study.kind as string,
        title: study.title as string,
        objective: (study.objective as string | null) ?? null,
      },
      questions: questionList,
      segment: segment
        ? { id: segment.id, label: segment.label, prompt: segment.prompt ?? null, persona_count: personaCount ?? 0 }
        : null,
      brief: { title: brief.scope?.title ?? null, objectives: brief.scope?.objectives ?? [] },
      methodology,
      generated_at: new Date().toISOString(),
    };

    if (!dataBlock.trim()) {
      await supabase.from("study_reports").upsert(
        { study_id: data.studyId, summary_md: "", themes: [] as never, citations: [] as never, context: contextPayload as never },
        { onConflict: "study_id" },
      );
      await supabase.from("studies").update({ status: "completed" }).eq("id", data.studyId);
      return { ok: true, empty: true };
    }

    const qBlock = questionList.map((q) => `Q${q.ord + 1} [${q.kind}] ${q.prompt}`).join("\n");
    const memoHeader = [
      "MEMO STRUCTURE — return exactly these markdown sections in this order:",
      "## TO / RE",
      "## Report frame — what this report is about",
      "## Original brief / scope — what decision this answers",
      "## Methodology — Cast, Group, Rehearse",
      "## Cast — who the personas are",
      "## Groups — which segment was tested",
      "## Rehearse — method, questions, and evidence base",
      "## Main conclusions — what we learned",
      "## Recommendations — decision-ready moves for the sovereign owner",
      "## Risks & unanswered questions — limits, dissent, and follow-up",
    ].join("\n");
    const rosterBlock = personaRoster
      .map((p, i) => `${i + 1}. ${p.name} — ${p.archetype ?? "—"}${p.summary ? `: ${String(p.summary).slice(0, 220)}` : ""}`)
      .join("\n") || "(no personas captured)";
    const raw = await ai(
      "You are a senior partner writing a decision-ready empirical research report for a Head of Government. Ground every claim in the DATA and CONTEXT. Cite [N] refs against the CITATION RULE. NEVER emit letterhead like 'FROM: McKinsey & Company' or firm names. Prose is crisp, active voice, no filler. Do not skip methodology, cast, groups, or rehearse sections.",
      `${memoHeader}\n\nBRIEF:\n${brief.block || "(no active brief captured)"}\n\nSTUDY:\n- title: ${study.title}\n- method: ${study.kind}\n- objective: ${study.objective ?? "(none)"}\n- segment: ${segment?.label ?? "(none)"} · ${personaRoster.length || personaCount || 0} personas\n\nCAST / PERSONAS:\n${rosterBlock}\n\nQUESTIONS ASKED:\n${qBlock}\n\nCOUNTRY CONTEXT:\n${pack.block}\n\nDATA:\n${dataBlock}\n\nReturn JSON: { "summary_md": "markdown report, ~700–1000 words, follow every section above in order, no letterhead", "themes": [ { "label":"…", "prevalence": 0.0-1.0, "quote":"…" } ], "recommendations": [ { "move":"…", "why":"…", "owner":"…", "horizon":"0-90d|3-12m|12-36m" } ], "citations": [N,...] }`,
    );
    const parsed = parseJson<{ summary_md?: string; themes?: unknown; recommendations?: unknown; citations?: number[] }>(raw);
    if (parsed?.summary_md) {
      const cleaned = stripBrandedByline(parsed.summary_md);
      const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(cleaned, parsed.citations));
      const ctxWithRecs = { ...contextPayload, recommendations: parsed.recommendations ?? [] };
      await supabase.from("study_reports").upsert(
        {
          study_id: data.studyId,
          summary_md: sanitizeCitationMarkersInText(cleaned, citations),
          themes: sanitizeJsonCitationMarkers(parsed.themes ?? [], citations) as never,
          citations: citations as never,
          context: ctxWithRecs as never,
        },
        { onConflict: "study_id" },
      );
    }
    await supabase.from("studies").update({ status: "completed" }).eq("id", data.studyId);
    return { ok: true };
  });

// Back-compat wrapper: run both phases sequentially (used by legacy callers).
export const runStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await runStudyResponses({ data: { studyId: data.studyId } });
    await runStudySynthesis({ data: { studyId: data.studyId } });
    return { ok: true };
  });

// ── Program-level (portfolio) synthesis across every completed study ─────
export const synthesizeStudyProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string(), projectId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Resolve the active project — either the one supplied or the country's
    // default. Multi-project support keys memos by project_id.
    const projectId = data.projectId ?? (await resolveDefaultProjectId(supabase, data.countryCode));

    let studyQ = supabase
      .from("studies")
      .select("id,title,kind,status,objective,segment_id,created_at,project_id")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(80);
    if (projectId) studyQ = studyQ.eq("project_id", projectId);
    const { data: studies } = await studyQ;
    const list = studies ?? [];
    const ids = list.map((s) => s.id as string);
    if (ids.length === 0) throw new Error("No studies to consolidate.");

    // persona_segments has no project_id column — scope only through the
    // studies we already loaded.
    const allSegIds = Array.from(new Set(list.map((s) => s.segment_id).filter((v): v is string => !!v)));

    const [{ data: reports }, { data: segRows }, { data: members }, { data: allQuestions }] = await Promise.all([
      supabase.from("study_reports").select("study_id,summary_md,themes,citations,context").in("study_id", ids),
      allSegIds.length
        ? supabase.from("persona_segments").select("id,label,prompt,size").in("id", allSegIds)
        : Promise.resolve({ data: [] as Array<{ id: string; label: string; prompt: string | null; size: number | null }> }),
      allSegIds.length
        ? supabase
            .from("persona_segment_members")
            .select("segment_id,persona_id,personas(id,name,archetype,summary,attributes,ocean)")
            .in("segment_id", allSegIds)
        : Promise.resolve({ data: [] as Array<{ segment_id: string; persona_id: string; personas: unknown }> }),
      supabase.from("study_questions").select("study_id,ord,prompt,kind,options").in("study_id", ids).order("ord"),
    ]);

    const segById = new Map<string, { id: string; label: string; prompt: string | null; size: number | null }>();
    for (const s of segRows ?? []) segById.set(s.id, { id: s.id, label: s.label, prompt: s.prompt, size: s.size });
    const segLabel = new Map<string, string>();
    for (const [id, s] of segById) segLabel.set(id, s.label);

    type PersonaLite = { id: string; name: string; archetype: string | null; summary: string | null; attributes: unknown; ocean: unknown };
    const personasBySeg = new Map<string, PersonaLite[]>();
    for (const m of members ?? []) {
      const p = (m as { personas: PersonaLite | null }).personas;
      if (!p) continue;
      const arr = personasBySeg.get(m.segment_id) ?? [];
      arr.push(p);
      personasBySeg.set(m.segment_id, arr);
    }

    type QuestionRow = { ord: number; prompt: string; kind: string; options: unknown };
    const questionsByStudy = new Map<string, QuestionRow[]>();
    for (const q of allQuestions ?? []) {
      const arr = questionsByStudy.get(q.study_id) ?? [];
      arr.push({ ord: q.ord as number, prompt: q.prompt as string, kind: q.kind as string, options: q.options });
      questionsByStudy.set(q.study_id, arr);
    }

    const repByStudy = new Map<string, { summary_md: string; themes: unknown; context: unknown; citations: unknown }>();
    for (const r of reports ?? []) repByStudy.set(r.study_id, { summary_md: r.summary_md ?? "", themes: r.themes, context: r.context, citations: r.citations });

    const brief = await loadCountryBrief(supabase, data.countryCode, projectId);
    const pack = await buildCountryContextPack(supabase, data.countryCode, brief.scope?.title ?? null);

    // Methodology snapshot — full & verbatim; feeds both the UI dossier and (a
    // trimmed slice of) the AI prompt so the memo can justify design choices.
    const methodology = {
      brief: {
        title: brief.scope?.title ?? null,
        objectives: brief.scope?.objectives ?? [],
        raw_excerpt: brief.briefRaw ? brief.briefRaw.slice(0, 1200) : null,
      },
      segments: (segRows ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        prompt: s.prompt,
        persona_count: (personasBySeg.get(s.id) ?? []).length,
        personas: (personasBySeg.get(s.id) ?? []).map((p) => ({
          id: p.id, name: p.name, archetype: p.archetype, summary: p.summary,
          ocean: p.ocean, attributes: p.attributes,
        })),
        used_by_studies: list
          .filter((st) => st.segment_id === s.id)
          .map((st) => ({ id: st.id, title: st.title, kind: st.kind })),
      })),
      studies: list.map((s) => ({
        id: s.id, title: s.title, kind: s.kind, objective: s.objective ?? null,
        segment_id: s.segment_id ?? null,
        segment_label: s.segment_id ? segLabel.get(s.segment_id as string) ?? null : null,
        persona_count: s.segment_id ? (personasBySeg.get(s.segment_id as string) ?? []).length : 0,
        questions: questionsByStudy.get(s.id as string) ?? [],
        has_report: repByStudy.has(s.id as string),
      })),
    };

    const perStudy = list
      .map((s) => {
        const rep = repByStudy.get(s.id as string);
        if (!rep || !rep.summary_md) return null;
        const qs = questionsByStudy.get(s.id as string) ?? [];
        const segName = s.segment_id ? segLabel.get(s.segment_id as string) : null;
        const nPersonas = s.segment_id ? (personasBySeg.get(s.segment_id as string) ?? []).length : 0;
        return [
          `## ${s.title} (${s.kind})`,
          `Segment: ${segName ?? "—"} · ${nPersonas} personas`,
          `Objective: ${s.objective ?? "(none)"}`,
          `Questions asked (${qs.length}):\n${qs.map((q) => `  Q${q.ord + 1} [${q.kind}] ${q.prompt}`).join("\n") || "(none)"}`,
          `Memo:\n${stripBrandedByline(rep.summary_md).slice(0, 2000)}`,
        ].join("\n");
      })
      .filter((v): v is string => !!v)
      .join("\n\n---\n\n")
      .slice(0, 16000);

    if (!perStudy.trim()) throw new Error("No synthesized studies yet — run studies before consolidating.");

    const segmentDigest = methodology.segments
      .map((s) => `- ${s.label} (${s.persona_count} personas): ${(s.prompt ?? "").slice(0, 200)}`)
      .join("\n") || "(no segments)";
    const castDigest = methodology.segments
      .map((s) => {
        const roster = s.personas.slice(0, 10)
          .map((p) => `  · ${p.name} — ${p.archetype ?? "—"}${p.summary ? `: ${String(p.summary).slice(0, 140)}` : ""}`)
          .join("\n");
        return `${s.label}:\n${roster || "  (no personas)"}`;
      })
      .join("\n\n");

    const raw = await ai(
      "You are a senior partner writing the portfolio-level consolidation memo across every study run for this sovereign owner. Ground in the ORIGINAL BRIEF; be explicit about what the studies did and did not answer, and justify the research design (why these segments, why these methods, why these questions). NEVER emit letterhead / firm names. Cite [N] against the CITATION RULE.",
      `ORIGINAL BRIEF:\n${brief.block || "(no active brief captured)"}\n\nGROUPS (segments used):\n${segmentDigest}\n\nCAST (synthetic personas, grouped by segment):\n${castDigest}\n\nSTUDIES CONSOLIDATED (${list.length}) — includes verbatim question set per study:\n${perStudy}\n\nCOUNTRY CONTEXT:\n${pack.block}\n\nReturn JSON with this shape:\n{\n  "summary_md": "markdown ~900–1200 words. Sections in this exact order and with these H2 headings:\\n## TO / RE\\n## What we asked (restate the brief in one paragraph)\\n## Methodology & design rationale (why THESE segments, why THESE methods per study, why THESE questions; how the cast covers the brief; what sampling limits remain)\\n## What we heard (portfolio-wide themes with evidence)\\n## Brand & ethos read\\n## Sovereign recommendations\\n## Sequencing & owners\\n## Risks & unanswered questions",\n  "sections": {\n    "portfolio_scope": { "studies_run": ${list.length}, "brief_link": "one sentence: how the studies answered the brief" },\n    "design_rationale": { "why_segments": "…", "why_methods": "…", "coverage_gaps": "…" },\n    "cross_cutting_themes": [ { "label":"…", "evidence_ids":[study titles], "quote":"…" } ],\n    "recommendations": [ { "move":"…", "why":"…", "owner":"…", "horizon":"0-90d|3-12m|12-36m" } ],\n    "unanswered": ["…"]\n  },\n  "citations": [N,...]\n}`,
    );
    const parsed = parseJson<{ summary_md?: string; sections?: unknown; citations?: number[] }>(raw);
    if (!parsed?.summary_md) throw new Error("Program synthesis returned no memo.");
    const cleaned = stripBrandedByline(parsed.summary_md);
    const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(cleaned, parsed.citations));

    const briefSnapshot = {
      title: brief.scope?.title ?? null,
      objectives: brief.scope?.objectives ?? [],
      raw_excerpt: brief.briefRaw ? brief.briefRaw.slice(0, 800) : null,
    };
    const studiesSnapshot = list.map((s) => ({
      id: s.id, title: s.title, kind: s.kind, status: s.status,
      segment_label: (s.segment_id ? segLabel.get(s.segment_id as string) : null) ?? null,
      has_report: repByStudy.has(s.id as string),
    }));

    // Upsert keyed by project (each project owns one program memo).
    // Fall back to a plain insert when no project (shouldn't happen post-backfill).
    if (projectId) {
      const { data: existing } = await supabase
        .from("study_program_reports")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();
      const payload = {
        country_code: data.countryCode,
        project_id: projectId,
        brief_snapshot: briefSnapshot as never,
        studies_snapshot: studiesSnapshot as never,
        summary_md: sanitizeCitationMarkersInText(cleaned, citations),
        sections: {
          ...(sanitizeJsonCitationMarkers(parsed.sections ?? {}, citations) as Record<string, unknown>),
          methodology,
        } as never,
        citations: citations as never,
        model: MODEL,
      };
      if (existing?.id) {
        await supabase.from("study_program_reports").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("study_program_reports").insert(payload);
      }
    }

    // Second-brain memory: upsert one memory_object per program memo so the
    // consolidated finding shows up in the country's Brain constellation.
    // Deduped by the memory_objects_dedup_idx on (scope_key, sector_code, kind, normalized-title).
    try {
      const project = projectId
        ? (await supabase.from("persona_projects").select("title,slug").eq("id", projectId).maybeSingle()).data
        : null;
      const memTitle = project?.title
        ? `Research program memo — ${project.title}`
        : "Research program memo";
      await supabase.from("memory_objects").upsert(
        {
          scope_key: data.countryCode,
          sector_code: "ALL",
          kind: "research_program",
          title: memTitle,
          payload: {
            project_id: projectId,
            summary_md: sanitizeCitationMarkersInText(cleaned, citations),
            sections: { ...(parsed.sections ?? {}), methodology },
            studies: studiesSnapshot,
            citations,
          } as never,
          weight: 4,
        } as never,
        { onConflict: "scope_key,sector_code,kind,title" },
      );
    } catch {
      // memory upsert is best-effort; program memo already persisted above.
    }

    return { ok: true, projectId, studies: list.length, synthesized: repByStudy.size };
  });

export const getStudyProgramReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string(), projectId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const projectId = data.projectId ?? (await resolveDefaultProjectId(supabase, data.countryCode));
    let q = supabase
      .from("study_program_reports")
      .select("*")
      .eq("country_code", data.countryCode)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (projectId) q = q.eq("project_id", projectId);
    const { data: rows } = await q;
    const row = (rows ?? [])[0];
    if (!row) return null;

    // Always attach a fresh methodology snapshot so pre-existing reports (saved
    // before the methodology column existed) still render Cast / Groups /
    // Instruments in the UI without requiring a Regenerate.
    const methodology = await buildProgramMethodology(supabase, data.countryCode, projectId);
    const existingSections = (row.sections ?? {}) as Record<string, unknown>;
    const mergedSections = { ...existingSections, methodology };

    // Round-trip through JSON so the RPC serializer sees only plain JSON values.
    const mergedSectionsJson = JSON.parse(JSON.stringify(mergedSections)) as Record<string, unknown>;
    return {
      ...row,
      summary_md: stripBrandedByline(row.summary_md),
      sections: mergedSectionsJson as never,
    };
  });

// Builds the methodology dossier from live DB state. Used both when persisting
// a fresh program memo and when reading an older memo that lacks the field.
async function buildProgramMethodology(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  countryCode: string,
  projectId: string | null,
) {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq?: (k: string, v: string) => { order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } };
          order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
        };
        in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> & {
          order?: (c: string) => Promise<{ data: unknown[] | null }>;
        };
      };
    };
  };

  let studyQ = (sb.from("studies").select("id,title,kind,objective,segment_id") as unknown as {
    eq: (k: string, v: string) => { eq?: (k: string, v: string) => { order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } }; order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } };
  }).eq("country_code", countryCode);
  if (projectId && studyQ.eq) studyQ = studyQ.eq("project_id", projectId) as never;
  const { data: rawStudies } = await (studyQ as { order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } })
    .order("created_at", { ascending: false }).limit(200);
  type StudyRow = { id: string; title: string; kind: string; objective: string | null; segment_id: string | null };
  const studies = (rawStudies ?? []) as StudyRow[];
  const studyIds = studies.map((s) => s.id);
  const segIds = Array.from(new Set(studies.map((s) => s.segment_id).filter((v): v is string => !!v)));

  const [segRes, memRes, qRes, repRes] = await Promise.all([
    segIds.length
      ? (supabase.from("persona_segments") as unknown as { select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> } })
          .select("id,label,prompt,size").in("id", segIds)
      : Promise.resolve({ data: [] }),
    segIds.length
      ? (supabase.from("persona_segment_members") as unknown as { select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> } })
          .select("segment_id,personas(id,name,archetype,summary,attributes,ocean)").in("segment_id", segIds)
      : Promise.resolve({ data: [] }),
    studyIds.length
      ? (supabase.from("study_questions") as unknown as { select: (c: string) => { in: (k: string, v: string[]) => { order: (c: string) => Promise<{ data: unknown[] | null }> } } })
          .select("study_id,ord,prompt,kind,options").in("study_id", studyIds).order("ord")
      : Promise.resolve({ data: [] }),
    studyIds.length
      ? (supabase.from("study_reports") as unknown as { select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> } })
          .select("study_id").in("study_id", studyIds)
      : Promise.resolve({ data: [] }),
  ]);

  type Seg = { id: string; label: string; prompt: string | null; size: number | null };
  const segs = (segRes.data ?? []) as Seg[];
  const segLabel = new Map(segs.map((s) => [s.id, s.label]));
  type PersonaLite = { id: string; name: string; archetype: string | null; summary: string | null; attributes: unknown; ocean: unknown };
  const bySeg = new Map<string, PersonaLite[]>();
  for (const m of (memRes.data ?? []) as Array<{ segment_id: string; personas: PersonaLite | null }>) {
    if (!m.personas) continue;
    const arr = bySeg.get(m.segment_id) ?? [];
    arr.push(m.personas);
    bySeg.set(m.segment_id, arr);
  }
  type QRow = { study_id: string; ord: number; prompt: string; kind: string; options: unknown };
  const qByStudy = new Map<string, Array<{ ord: number; prompt: string; kind: string; options: unknown }>>();
  for (const q of (qRes.data ?? []) as QRow[]) {
    const arr = qByStudy.get(q.study_id) ?? [];
    arr.push({ ord: q.ord, prompt: q.prompt, kind: q.kind, options: q.options });
    qByStudy.set(q.study_id, arr);
  }
  const withReport = new Set(((repRes.data ?? []) as Array<{ study_id: string }>).map((r) => r.study_id));

  const brief = await loadCountryBrief(supabase, countryCode, projectId);
  return {
    brief: {
      title: brief.scope?.title ?? null,
      objectives: brief.scope?.objectives ?? [],
      raw_excerpt: brief.briefRaw ? brief.briefRaw.slice(0, 1200) : null,
    },
    segments: segs.map((s) => ({
      id: s.id, label: s.label, prompt: s.prompt,
      persona_count: (bySeg.get(s.id) ?? []).length,
      personas: (bySeg.get(s.id) ?? []).map((p) => ({
        id: p.id, name: p.name, archetype: p.archetype, summary: p.summary,
        ocean: p.ocean, attributes: p.attributes,
      })),
      used_by_studies: studies
        .filter((st) => st.segment_id === s.id)
        .map((st) => ({ id: st.id, title: st.title, kind: st.kind })),
    })),
    studies: studies.map((s) => ({
      id: s.id, title: s.title, kind: s.kind, objective: s.objective ?? null,
      segment_id: s.segment_id ?? null,
      segment_label: s.segment_id ? segLabel.get(s.segment_id) ?? null : null,
      persona_count: s.segment_id ? (bySeg.get(s.segment_id) ?? []).length : 0,
      questions: qByStudy.get(s.id) ?? [],
      has_report: withReport.has(s.id),
    })),
  };
}

// Resolve the country's "default" project id (created by the multi-project
// migration). Returns null only if no project has been backfilled yet.
async function resolveDefaultProjectId(
  supabase: { from: (t: string) => unknown },
  countryCode: string,
): Promise<string | null> {
  const q = (supabase.from("persona_projects") as unknown as {
    select: (c: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> } } };
  })
    .select("id")
    .eq("country_code", countryCode)
    .eq("slug", "default");
  const { data } = await q.maybeSingle();
  return data?.id ?? null;
}


// ── Digest for the Stage-03 studies list ─────────────────────────────────
export const listStudiesWithReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ countryCode: z.string(), projectId: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("studies")
      .select("id,title,kind,status,objective,created_at,segment_id,visibility,project_id")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const studies = rows ?? [];
    type Recommendation = { move?: string; why?: string; owner?: string };
    type Question = { ord?: number; prompt?: string; kind?: string };
    type Digest = {
      id: string; title: string; kind: string; status: string; objective: string | null; created_at: string;
      segment_id: string | null; segment_label: string | null; segment_prompt: string | null; persona_count: number;
      summary_md: string | null;
      themes: Array<{ label?: string; prevalence?: number; quote?: string }>;
      recommendations: Recommendation[];
      questions: Question[];
      citations: ContextCitation[];
    };
    if (studies.length === 0) return [] as Digest[];

    const ids = studies.map((s) => s.id);
    const segIds = Array.from(new Set(studies.map((s) => s.segment_id).filter((v): v is string => !!v)));

    const [{ data: reports }, { data: segments }, { data: members }] = await Promise.all([
      supabase.from("study_reports").select("study_id,summary_md,themes,citations,context,created_at").in("study_id", ids),
      segIds.length
        ? supabase.from("persona_segments").select("id,label,prompt").in("id", segIds)
        : Promise.resolve({ data: [] as Array<{ id: string; label: string; prompt: string | null }> }),
      segIds.length
        ? supabase.from("persona_segment_members").select("segment_id,persona_id").in("segment_id", segIds)
        : Promise.resolve({ data: [] as Array<{ segment_id: string; persona_id: string }> }),
    ]);

    const reportByStudy = new Map<string, { summary_md: string | null; themes: unknown; citations: unknown; context: unknown }>();
    for (const r of reports ?? []) {
      const existing = reportByStudy.get(r.study_id);
      if (!existing) reportByStudy.set(r.study_id, { summary_md: r.summary_md, themes: r.themes, citations: r.citations, context: r.context });
    }
    const segById = new Map<string, { label: string; prompt: string | null }>();
    for (const s of segments ?? []) segById.set(s.id, { label: s.label, prompt: s.prompt });
    const countBySeg = new Map<string, number>();
    for (const m of members ?? []) countBySeg.set(m.segment_id, (countBySeg.get(m.segment_id) ?? 0) + 1);

    // Fetch pack once per country for citation hydration on any report.
    const anyReport = (reports ?? []).length > 0;
    const pack = anyReport ? await buildCountryContextPack(supabase, data.countryCode) : null;

    return studies.map((s) => {
      const rep = reportByStudy.get(s.id) ?? null;
      let summary_md: string | null = null;
      let themes: Array<{ label?: string; prevalence?: number; quote?: string }> = [];
      let citations: ContextCitation[] = [];
      let recommendations: Recommendation[] = [];
      let questions: Question[] = [];
      if (rep && pack) {
        const rawSummary = stripBrandedByline(rep.summary_md ?? "");
        const cites = fullCitationsForRefs(pack.citations, refsFromTextAndModel(rawSummary, rep.citations));
        summary_md = rawSummary ? sanitizeCitationMarkersInText(rawSummary, cites) : null;
        const rawThemes = sanitizeJsonCitationMarkers(rep.themes ?? [], cites);
        themes = Array.isArray(rawThemes) ? (rawThemes as typeof themes) : [];
        citations = cites;
        const ctx = (rep.context ?? {}) as { recommendations?: unknown; questions?: unknown };
        recommendations = Array.isArray(ctx.recommendations) ? (ctx.recommendations as Recommendation[]) : [];
        questions = Array.isArray(ctx.questions) ? (ctx.questions as Question[]) : [];
      }
      const seg = s.segment_id ? segById.get(s.segment_id) : null;
      return {
        id: s.id as string,
        title: s.title as string,
        kind: s.kind as string,
        status: s.status as string,
        objective: (s.objective as string | null) ?? null,
        created_at: s.created_at as string,
        segment_id: s.segment_id as string | null,
        segment_label: seg?.label ?? null,
        segment_prompt: seg?.prompt ?? null,
        persona_count: s.segment_id ? countBySeg.get(s.segment_id) ?? 0 : 0,
        summary_md,
        themes,
        recommendations,
        questions,
        citations,
      };
    });
  });


export const listStudies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string(), projectId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Self-heal: any study that already produced a non-empty synthesis report
    // but never had its status flipped (worker timeout, tab close, retry) is
    // reconciled to `complete` so the UI counters stop drifting.
    try {
      let stuckQuery = supabase
        .from("studies")
        .select("id")
        .eq("country_code", data.countryCode)
        .neq("status", "completed")
        .limit(500);
      if (data.projectId) stuckQuery = stuckQuery.eq("project_id", data.projectId);
      const { data: stuck } = await stuckQuery;
      const stuckIds = (stuck ?? []).map((r) => r.id as string);
      if (stuckIds.length > 0) {
        const { data: reps } = await supabase
          .from("study_reports")
          .select("study_id,summary_md")
          .in("study_id", stuckIds);
        const doneIds = (reps ?? [])
          .filter((r) => (r.summary_md ?? "").trim().length > 0)
          .map((r) => r.study_id as string);
        if (doneIds.length > 0) {
          await supabase.from("studies").update({ status: "completed" }).in("id", doneIds);
        }
      }
    } catch {
      // reconciliation is best-effort; never block the list read
    }

    let q = supabase
      .from("studies")
      .select("id,title,kind,status,objective,created_at,segment_id,visibility,project_id")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const studies = rows ?? [];
    if (studies.length === 0) return [];

    const ids = studies.map((s) => s.id as string);
    const { data: reports } = await supabase
      .from("study_reports")
      .select("study_id,summary_md")
      .in("study_id", ids);
    const reportByStudy = new Map<string, { hasReport: boolean; chars: number }>();
    for (const r of reports ?? []) {
      const summary = String(r.summary_md ?? "").trim();
      if (summary.length > 0) {
        reportByStudy.set(r.study_id as string, { hasReport: true, chars: summary.length });
      }
    }

    return studies.map((s) => {
      const report = reportByStudy.get(s.id as string);
      const hasReport = !!report?.hasReport;
      const rawStatus = s.status as string;
      return {
        ...s,
        raw_status: rawStatus,
        status: hasReport ? "completed" : rawStatus,
        is_synthesized: hasReport || rawStatus === "completed" || rawStatus === "complete" || rawStatus === "synthesized",
        has_report: hasReport,
        report_summary_chars: report?.chars ?? 0,
      };
    });
  });

export const getStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string(), projectId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let studyQ = supabase.from("studies").select("*").eq("id", data.id);
    if (data.projectId) studyQ = studyQ.eq("project_id", data.projectId);
    const [{ data: study }, { data: questions }, { data: responses }, { data: transcript }, { data: report }] = await Promise.all([
      studyQ.maybeSingle(),
      supabase.from("study_questions").select("*").eq("study_id", data.id).order("ord"),
      supabase
        .from("study_responses")
        .select("*, personas(id,name,archetype)")
        .eq("study_id", data.id)
        .limit(500),
      supabase.from("study_transcripts").select("*").eq("study_id", data.id).order("ord").limit(500),
      supabase.from("study_reports").select("*").eq("study_id", data.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const pack = study ? await buildCountryContextPack(supabase, study.country_code, study.objective ?? study.title) : null;
    const methodology = study ? await buildStudyMethodology(supabase, study, questions ?? []) : null;
    return {
      study,
      questions: questions ?? [],
      responses: pack
        ? (responses ?? []).map((r) => {
            const hydrated = hydrateCitationField(r, pack.citations) as typeof r & { answer?: unknown; rationale?: string | null; citations?: unknown };
            const markerText = `${typeof hydrated.answer === "string" ? hydrated.answer : JSON.stringify(hydrated.answer ?? "")} ${hydrated.rationale ?? ""}`;
            const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(markerText, hydrated.citations));
            return {
              ...hydrated,
              answer: sanitizeJsonCitationMarkers(hydrated.answer, citations) as typeof hydrated.answer,
              rationale: hydrated.rationale ? sanitizeCitationMarkersInText(hydrated.rationale, citations) : hydrated.rationale,
              citations: citations as unknown as typeof hydrated.citations,
            };
          })
        : responses ?? [],
      transcript: pack
        ? (transcript ?? []).map((t) => {
            const hydrated = hydrateCitationField(t, pack.citations) as typeof t & { utterance?: string | null; citations?: unknown };
            const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(hydrated.utterance, hydrated.citations));
            return {
              ...hydrated,
              utterance: hydrated.utterance ? sanitizeCitationMarkersInText(hydrated.utterance, citations) : hydrated.utterance,
              citations: citations as unknown as typeof hydrated.citations,
            };
          })
        : transcript ?? [],
      report: pack && report
        ? (() => {
            const hydrated = hydrateCitationField(report, pack.citations);
            const cleaned = stripBrandedByline(hydrated.summary_md ?? "");
            const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(cleaned, hydrated.citations));
            const existingContext = hydrated.context && typeof hydrated.context === "object" ? hydrated.context as Record<string, Json | undefined> : {};
            return {
              ...hydrated,
              summary_md: cleaned ? sanitizeCitationMarkersInText(cleaned, citations) : hydrated.summary_md,
              themes: toJson(sanitizeJsonCitationMarkers(hydrated.themes ?? [], citations)),
              citations: toJson(citations),
              context: methodology ? ({ ...existingContext, methodology } as Json) : ((hydrated.context ?? null) as Json),
            };
          })()
        : report ?? null,
    };
  });

async function buildStudyMethodology(
  supabase: AppSupabaseClient,
  study: { country_code: string; project_id: string | null; title: string; objective: string | null; kind: string; segment_id: string | null },
  questions: Array<{ ord?: number | null; prompt?: string | null; kind?: string | null; options?: Json | null }>,
): Promise<Json> {
  const [{ data: segment }, { data: members }] = await Promise.all([
    study.segment_id
      ? supabase.from("persona_segments").select("id,label,prompt").eq("id", study.segment_id).maybeSingle()
      : Promise.resolve({ data: null as { id: string; label: string; prompt: string | null } | null }),
    study.segment_id
      ? supabase
          .from("persona_segment_members")
          .select("segment_id,personas(id,name,archetype,summary,attributes,ocean)")
          .eq("segment_id", study.segment_id)
      : Promise.resolve({ data: [] as Array<{ segment_id: string; personas: unknown }> }),
  ]);
  const brief = await loadCountryBrief(supabase, study.country_code, study.project_id);
  const personas = (members ?? [])
    .flatMap((m) => {
      const p = (m as { personas: unknown }).personas;
      return Array.isArray(p) ? p : p ? [p] : [];
    })
    .filter((p): p is Record<string, unknown> & { id: string; name: string } => !!p && typeof p === "object")
    .map((p) => ({
      id: p.id,
      name: p.name,
      archetype: (p.archetype as string | null | undefined) ?? null,
      summary: (p.summary as string | null | undefined) ?? null,
      attributes: p.attributes ?? null,
      ocean: p.ocean ?? null,
    }));

  return toJson({
    report_frame: {
      country_code: study.country_code,
      project_id: study.project_id ?? null,
      title: study.title,
      objective: study.objective ?? null,
      decision_question: String(brief.scope?.title ?? study.objective ?? study.title),
    },
    brief: {
      title: brief.scope?.title ?? null,
      objectives: brief.scope?.objectives ?? [],
      raw_excerpt: brief.briefRaw ? brief.briefRaw.slice(0, 1200) : null,
    },
    workflow: {
      cast: "Synthetic personas were generated from the committed brief and country corpus to represent materially different stakeholder voices.",
      group: "Personas were organized into a segment with a shared decision context, lived experience, and policy exposure.",
      rehearse: "The study instrument was run against the cast so each persona could respond in character before synthesis.",
    },
    segment: segment
      ? { id: segment.id, label: segment.label, prompt: segment.prompt ?? null, persona_count: personas.length }
      : null,
    personas,
    instrument: {
      kind: study.kind,
      title: study.title,
      objective: study.objective ?? null,
      questions: questions.map((q) => ({
        ord: typeof q.ord === "number" ? q.ord : 0,
        prompt: String(q.prompt ?? ""),
        kind: String(q.kind ?? "open"),
        options: q.options ?? [],
      })),
    },
    limitations: [
      "Synthetic research is directional and should be treated as a fast empirical rehearsal, not a replacement for fieldwork.",
      "Findings are strongest where persona responses converge with cited country-context evidence.",
    ],
    generated_at: new Date().toISOString(),
  });
}

// ── Persona chat (Ask this persona) ───────────────────────────────────────
export const askPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ personaId: z.string(), chatId: z.string().optional(), message: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: persona } = await supabase.from("personas").select("*").eq("id", data.personaId).maybeSingle();
    if (!persona) throw new Error("Persona not found");

    let chatId = data.chatId;
    if (!chatId) {
      const { data: chat, error } = await supabase
        .from("persona_chats")
        .insert({
          persona_id: data.personaId,
          country_code: persona.country_code,
          user_id: userId,
          title: data.message.slice(0, 60),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      chatId = chat.id;
    }

    const { data: history } = await supabase
      .from("persona_chat_messages")
      .select("role,content")
      .eq("chat_id", chatId)
      .order("created_at")
      .limit(40);

    await supabase.from("persona_chat_messages").insert({
      chat_id: chatId,
      role: "user",
      content: data.message,
      citations: [] as never,
    });

    const pack = await buildCountryContextPack(supabase, persona.country_code);
    const historyBlock = (history ?? []).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n").slice(0, 4000);
    const answer = await ai(
      `You ARE the persona described below. Answer in first person, in that persona's voice, biases, and vocabulary. Never break character. Ground in country context; cite [N] where relevant.`,
      `PERSONA:\n${personaBlock(persona as never)}\n\nCOUNTRY CONTEXT:\n${pack.block}\n\nCONVERSATION SO FAR:\n${historyBlock}\n\nNEW USER MESSAGE: ${data.message}\n\nReply as the persona in plain prose (no JSON, no preamble).`,
      false,
      0.85,
    );

    const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(answer, null));
    const content = sanitizeCitationMarkersInText(answer, citations);
    const { data: assistantMsg } = await supabase
      .from("persona_chat_messages")
      .insert({
        chat_id: chatId,
        role: "assistant",
        content,
        citations: citations as never,
      })
      .select()
      .single();

    return { chatId, message: assistantMsg, citations };
  });

export const getPersonaChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chatId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: messages } = await context.supabase
      .from("persona_chat_messages")
      .select("*")
      .eq("chat_id", data.chatId)
      .order("created_at");
    return (messages ?? []).map((message) => {
      const citations = fullCitationsForRefs(message.citations as unknown as ContextCitation[], message.citations);
      return {
        ...message,
        content: message.content ? sanitizeCitationMarkersInText(message.content, citations) : message.content,
        citations: citations as never,
      };
    });
  });

export const listPersonaChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ personaId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: chats } = await context.supabase
      .from("persona_chats")
      .select("id,title,created_at,updated_at")
      .eq("persona_id", data.personaId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return chats ?? [];
  });
