// Chamber 07 · Field → second brain.
//
// Every artefact returned by real-world fieldwork (survey responses, focus
// group transcripts, interview notes) is folded into the country's corpus,
// tagged to the briefed programme so any chamber can cite it later.
//
// Two hard rules, enforced here rather than at the call sites:
//   1. Field-derived corpus rows are PRIVATE to the owning country.
//   2. No participant PII ever enters the corpus. Identity stays in the CRM;
//      evidence is attributed by pseudonymous participant code only.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertMemoryObject } from "@/lib/corpus/writers.server";

const PII_KEYS = new Set([
  "name",
  "full_name",
  "fullname",
  "email",
  "email_address",
  "phone",
  "phone_number",
  "mobile",
  "address",
  "contact",
  "contact_id",
]);

/** Strip anything that looks like direct identity from a response payload. */
export function scrubPii(answers: unknown): unknown {
  if (Array.isArray(answers)) return answers.map(scrubPii);
  if (answers && typeof answers === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase().replace(/\s+/g, "_"))) continue;
      out[k] = scrubPii(v);
    }
    return out;
  }
  return answers;
}

export interface FieldCorpusTag {
  countryCode: string;
  projectId: string | null;
  projectTitle: string;
  studyId: string;
  studyTitle: string;
  method: string | null;
}

/**
 * Write a batch of survey responses into the corpus as one programme-scoped
 * memory object. Idempotent: the dedup key is (country, kind, title), so a
 * re-ingest of the same collection updates in place rather than duplicating.
 */
export async function ingestResponsesToCorpus(args: {
  tag: FieldCorpusTag;
  collectionId: string;
  responses: Array<{ participant_code: string; answers: unknown; submitted_at: string }>;
}): Promise<{ id: string } | null> {
  if (args.responses.length === 0) return null;
  const { tag } = args;

  const scrubbed = args.responses.map((r) => ({
    participant: r.participant_code,
    submitted_at: r.submitted_at,
    answers: scrubPii(r.answers),
  }));

  const res = await upsertMemoryObject({
    scope_key: tag.countryCode,
    kind: "research_field_responses",
    title: `Field responses · ${tag.studyTitle}`.slice(0, 240),
    weight: 4,
    sector_code: "cross",
    payload: {
      evidence_type: "real_world_field_research",
      synthetic: false,
      programme_id: tag.projectId,
      programme: tag.projectTitle,
      study_id: tag.studyId,
      study: tag.studyTitle,
      method: tag.method ?? "survey",
      collection_id: args.collectionId,
      response_count: scrubbed.length,
      responses: scrubbed,
      ingested_at: new Date().toISOString(),
    },
  });

  if (res?.id) {
    await supabaseAdmin
      .from("field_responses")
      .update({ ingested_to_corpus_at: new Date().toISOString() })
      .eq("collection_id", args.collectionId)
      .is("ingested_to_corpus_at", null);
  }
  return res ? { id: res.id } : null;
}

/**
 * Write a session transcript (focus group, interview, panel) into the corpus,
 * attributed to the session and its pseudonymous attendees.
 */
export async function ingestSessionToCorpus(args: {
  tag: FieldCorpusTag;
  sessionId: string;
  sessionTitle: string;
  scheduledAt: string | null;
  transcript: string;
  notes?: string | null;
  participantCodes: string[];
}): Promise<{ id: string } | null> {
  const body = args.transcript.trim();
  if (body.length < 40) return null;

  const res = await upsertMemoryObject({
    scope_key: args.tag.countryCode,
    kind: "research_field_session",
    title: `Field session · ${args.sessionTitle}`.slice(0, 240),
    weight: 4,
    sector_code: "cross",
    payload: {
      evidence_type: "real_world_field_research",
      synthetic: false,
      programme_id: args.tag.projectId,
      programme: args.tag.projectTitle,
      study_id: args.tag.studyId,
      study: args.tag.studyTitle,
      method: args.tag.method ?? "focus_group",
      session_id: args.sessionId,
      held_at: args.scheduledAt,
      participants: args.participantCodes,
      transcript: body.slice(0, 200_000),
      moderator_notes: args.notes ?? null,
      ingested_at: new Date().toISOString(),
    },
  });

  if (res?.id) {
    await supabaseAdmin
      .from("field_sessions")
      .update({ ingested_to_corpus_at: new Date().toISOString() })
      .eq("id", args.sessionId);
  }
  return res ? { id: res.id } : null;
}

/** Write a synthesised finding (per study) or programme memo (at close). */
export async function ingestFindingToCorpus(args: {
  tag: FieldCorpusTag;
  scope: "study" | "programme";
  title: string;
  finding: unknown;
}): Promise<{ id: string } | null> {
  const res = await upsertMemoryObject({
    scope_key: args.tag.countryCode,
    kind: args.scope === "programme" ? "research_programme" : "research_finding",
    title: args.title.slice(0, 240),
    weight: 5,
    sector_code: "cross",
    payload: {
      evidence_type: "real_world_field_research",
      synthetic: false,
      programme_id: args.tag.projectId,
      programme: args.tag.projectTitle,
      study_id: args.tag.studyId,
      study: args.tag.studyTitle,
      method: args.tag.method,
      finding: args.finding,
      ingested_at: new Date().toISOString(),
    },
  });
  return res ? { id: res.id } : null;
}

/** Resolve the programme/study tag used on every corpus write. */
export async function buildFieldTag(studyId: string): Promise<FieldCorpusTag> {
  const { data: study } = await supabaseAdmin
    .from("studies")
    .select("id,title,country_code,method,project_id")
    .eq("id", studyId)
    .maybeSingle();
  if (!study) throw new Error("Study not found");

  let projectTitle = "Unassigned programme";
  if (study.project_id) {
    const { data: project } = await supabaseAdmin
      .from("persona_projects")
      .select("title")
      .eq("id", study.project_id as string)
      .maybeSingle();
    if (project?.title) projectTitle = project.title as string;
  }

  return {
    countryCode: study.country_code as string,
    projectId: (study.project_id as string | null) ?? null,
    projectTitle,
    studyId: study.id as string,
    studyTitle: study.title as string,
    method: (study.method as string | null) ?? null,
  };
}

/**
 * File an approved programme plan into the country's second brain.
 *
 * Idempotent by (country, kind, title) — re-approving a plan updates the same
 * memory object rather than duplicating it. Private to the owning country, in
 * line with the rest of the field track.
 */
export async function ingestProgrammePlanToCorpus(args: {
  countryCode: string;
  projectId: string;
  projectTitle: string;
  planId: string;
  version: number;
  startsOn: string | null;
  endsOn: string | null;
  summary: string | null;
  objectives: unknown;
  methodMix: unknown;
  audience: unknown;
  risks: unknown;
  rationale: unknown;
  phases: Array<{ name: string; intent: string | null; starts_on: string | null; ends_on: string | null }>;
  milestones: Array<{ title: string; detail: string | null; owner: string | null; due_on: string | null }>;
  deliverables: Array<{ title: string; kind: string | null; owner: string | null; due_on: string | null }>;
}): Promise<{ id: string } | null> {
  const res = await upsertMemoryObject({
    scope_key: args.countryCode,
    kind: "research_programme_plan",
    title: `Programme plan · ${args.projectTitle}`.slice(0, 240),
    weight: 5,
    sector_code: "cross",
    payload: {
      evidence_type: "real_world_field_research",
      synthetic: false,
      programme_id: args.projectId,
      programme: args.projectTitle,
      plan_id: args.planId,
      version: args.version,
      window: { starts_on: args.startsOn, ends_on: args.endsOn },
      summary: args.summary,
      objectives: args.objectives,
      method_mix: args.methodMix,
      audience: args.audience,
      risks: args.risks,
      rationale: args.rationale,
      phases: args.phases,
      milestones: args.milestones,
      deliverables: args.deliverables,
      approved_at: new Date().toISOString(),
    },
  });
  return res ? { id: res.id } : null;
}
