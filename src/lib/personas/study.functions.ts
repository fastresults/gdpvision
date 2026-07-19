// Chamber 07 · Studies (survey, focus group, creative test) + persona chat.

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

const MODEL = "google/gemini-2.5-pro";

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
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
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
    const { data: row, error } = await supabase
      .from("studies")
      .insert({
        country_code: data.countryCode,
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
    if (error) throw new Error(error.message);
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
export const runStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { study, questions, personas } = await loadStudyWithPersonas(supabase, data.studyId);
    if (!questions.length) throw new Error("No questions — draft them first.");
    if (!personas.length) throw new Error("Segment has no personas.");

    await supabase.from("studies").update({ status: "running" }).eq("id", data.studyId);
    await supabase.from("study_responses").delete().eq("study_id", data.studyId);
    await supabase.from("study_transcripts").delete().eq("study_id", data.studyId);
    await supabase.from("study_reports").delete().eq("study_id", data.studyId);

    const pack = await buildCountryContextPack(supabase, study.country_code, study.objective ?? study.title);
    const qBlock = questions.map((q, i) => `Q${i + 1} [${q.kind}] ${q.prompt}${q.options && Array.isArray(q.options) && (q.options as unknown[]).length ? ` (options: ${JSON.stringify(q.options)})` : ""}`).join("\n");

    if (study.kind === "survey" || study.kind === "creative_test") {
      // Per-persona batched response
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
      // Single generation: 3-round moderated group discussion
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

    // Synthesis report
    const [{ data: responses }, { data: transcript }] = await Promise.all([
      supabase.from("study_responses").select("*, personas(name,archetype)").eq("study_id", data.studyId).limit(500),
      supabase.from("study_transcripts").select("*").eq("study_id", data.studyId).order("ord").limit(500),
    ]);
    try {
      const dataBlock = study.kind === "focus_group"
        ? (transcript ?? []).map((t) => `${t.speaker}: ${t.utterance}`).join("\n").slice(0, 8000)
        : (responses ?? []).map((r) => {
            const persona = (r as { personas?: { name?: string; archetype?: string } | null }).personas;
            return `[${persona?.name ?? "?"} · ${persona?.archetype ?? ""}] ${JSON.stringify(r.answer).slice(0, 400)}${r.rationale ? ` — ${r.rationale}` : ""}`;
          }).join("\n").slice(0, 8000);

      const raw = await ai(
        "You are a McKinsey partner. Synthesize this market-research output into a decision-ready brief. Cite [N] refs.",
        `STUDY: ${study.title} (${study.kind})\nOBJECTIVE: ${study.objective ?? "(none)"}\n${pack.block}\n\nDATA:\n${dataBlock}\n\nReturn JSON: { "summary_md": "markdown, ~250 words, use ## headings and bullets", "themes": [ { "label":"…", "prevalence": 0.0-1.0, "quote":"…" } ], "citations": [N,...] }`,
      );
      const parsed = parseJson<{ summary_md?: string; themes?: unknown; citations?: number[] }>(raw);
      if (parsed?.summary_md) {
        const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(parsed.summary_md, parsed.citations));
        await supabase.from("study_reports").insert({
          study_id: data.studyId,
          summary_md: sanitizeCitationMarkersInText(parsed.summary_md, citations),
          themes: sanitizeJsonCitationMarkers(parsed.themes ?? [], citations) as never,
          citations: citations as never,
        });
      }
    } catch (e) {
      console.warn("[report]", (e as Error).message);
    }

    await supabase.from("studies").update({ status: "complete" }).eq("id", data.studyId);
    return { ok: true };
  });

export const listStudies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("studies")
      .select("id,title,kind,status,objective,created_at,segment_id,visibility")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: study }, { data: questions }, { data: responses }, { data: transcript }, { data: report }] = await Promise.all([
      supabase.from("studies").select("*").eq("id", data.id).maybeSingle(),
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
            const hydrated = hydrateCitationField(report, pack.citations) as typeof report & { summary_md?: string | null; themes?: unknown; citations?: unknown };
            const citations = fullCitationsForRefs(pack.citations, refsFromTextAndModel(hydrated.summary_md, hydrated.citations));
            return {
              ...hydrated,
              summary_md: hydrated.summary_md ? sanitizeCitationMarkersInText(hydrated.summary_md, citations) : hydrated.summary_md,
              themes: sanitizeJsonCitationMarkers(hydrated.themes ?? [], citations) as typeof hydrated.themes,
              citations: citations as unknown as typeof hydrated.citations,
            };
          })()
        : report ?? null,
    };
  });

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
        content: answer,
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
    return messages ?? [];
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
