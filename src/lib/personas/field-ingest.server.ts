// Chamber 07 · Stage 04 — fieldwork ingestion.
//
// Capture anywhere, land everywhere. Research is rarely all done inside one
// system: a ministry runs the questionnaire on paper, an agency fields it in
// their own tool, a focus group is recorded on a phone. This module takes
// whatever comes back, reads it, maps it onto the study's instrument, stages
// the result for a human to check, and only then writes it into the fieldwork
// ledger and the second brain.
//
// Parse → Classify → Map → Stage → Review → Commit. Nothing is committed
// without a person seeing the mapping first.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import { extractArtifact } from "./artifact-extract.server";
import { deriveJson } from "./field-ai.server";
import type { FieldQuestion } from "./instrument-draft.server";

type Db = SupabaseClient<Database>;

export type IngestKind = "tabular" | "narrative";

/** Answer values are serialisable by construction — they cross the RPC boundary. */
export type AnswerValue = string | number | boolean | null | string[] | number[];

export interface MappingLine {
  /** Column header (tabular) or the phrase in the document the answer came from. */
  column: string;
  question_id: string | null;
  confidence: number;
  note?: string;
}

export interface StagedRow {
  index: number;
  participant_code: string;
  answers: Record<string, AnswerValue>;
  completeness: number;
  flags: string[];
  include: boolean;
}

export interface StagedNarrative {
  title: string;
  summary: string;
  transcript: string;
  /** Answers the moderator's notes settle against instrument questions. */
  answers: Record<string, AnswerValue>;
  flags: string[];
}

export interface IngestBatch {
  id: string;
  study_id: string;
  wave_id: string | null;
  collection_id: string | null;
  session_id: string | null;
  instrument_id: string | null;
  instrument_version: number | null;
  kind: string;
  status: string;
  filename: string | null;
  source: string;
  mapping: MappingLine[];
  staged: StagedRow[] | StagedNarrative[];
  warnings: string[];
  row_count: number;
  mapped_count: number;
  flagged_count: number;
  unmapped_count: number;
  committed_count: number;
  committed_at: string | null;
  created_at: string;
}

// ── Parsing ────────────────────────────────────────────────────────────────

/** Minimal RFC-4180-tolerant delimited parser — quotes, embedded newlines. */
export function parseDelimited(text: string): string[][] {
  const sample = text.slice(0, 2_000);
  const delim = (sample.match(/\t/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

// ── Mapping ────────────────────────────────────────────────────────────────

interface MapReply {
  mapping: MappingLine[];
  notes?: string[];
}

function isMapReply(v: unknown): v is MapReply {
  const r = v as MapReply | null;
  return !!r && Array.isArray(r.mapping);
}

function questionCatalogue(questions: FieldQuestion[]) {
  return questions
    .map((q) => {
      const opts = q.options?.length ? ` options: ${q.options.slice(0, 12).join(" | ")}` : "";
      const scale =
        q.scale_min != null ? ` scale ${q.scale_min}-${q.scale_max ?? ""}` : "";
      return `- ${q.id} (${q.type}${scale}): ${q.prompt}${opts}`;
    })
    .join("\n");
}

/** Ask the model which uploaded column answers which instrument question. */
export async function mapColumns(
  headers: string[],
  sampleRows: string[][],
  questions: FieldQuestion[],
): Promise<MapReply> {
  const sample = sampleRows
    .slice(0, 6)
    .map((r) => r.map((v) => v.slice(0, 60)).join(" | "))
    .join("\n");

  const reply = await deriveJson<MapReply>({
    system: `You align a file of research returns collected outside the system with the study's own instrument. Match on meaning, not wording: an uploaded column "How satisfied are you overall?" answers a question about overall satisfaction even if phrased differently.

Rules:
- Every uploaded column gets exactly one line in "mapping", in file order.
- question_id must be one of the listed instrument question ids, or null when the column answers nothing in the instrument (respondent name, timestamp, internal ids, free notes).
- confidence is 0 to 1. Below 0.6 means a human should look.
- Never invent question ids.`,
    user: `INSTRUMENT QUESTIONS:
${questionCatalogue(questions)}

UPLOADED COLUMNS (in order):
${headers.map((h, i) => `${i + 1}. ${h}`).join("\n")}

FIRST ROWS OF DATA:
${sample}

Return JSON: {"mapping":[{"column":"...","question_id":"q1"|null,"confidence":0.0,"note":"why"}],"notes":["anything the researcher should know"]}`,
    validate: isMapReply,
  });
  return reply;
}

/** Coerce a raw cell to the shape the question expects, flagging what won't fit. */
function coerce(q: FieldQuestion | undefined, raw: string): { value: AnswerValue; flag?: string } {
  const v = raw.trim();
  if (!q) return { value: v };
  if (v === "") return { value: null };
  switch (q.type) {
    case "scale": {
      const n = Number(v.replace(/[^\d.-]/g, ""));
      if (Number.isNaN(n)) return { value: v, flag: `${q.id}: "${v}" is not a number` };
      const min = q.scale_min ?? 1;
      const max = q.scale_max ?? 10;
      if (n < min || n > max) return { value: n, flag: `${q.id}: ${n} is outside ${min}–${max}` };
      return { value: n };
    }
    case "multi_choice": {
      const parts = v
        .split(/[;|]|,(?![^(]*\))/)
        .map((p) => p.trim())
        .filter(Boolean);
      const unknown = q.options?.length
        ? parts.filter((p) => !q.options?.some((o) => o.toLowerCase() === p.toLowerCase()))
        : [];
      return {
        value: parts,
        ...(unknown.length ? { flag: `${q.id}: unlisted option(s) ${unknown.join(", ")}` } : {}),
      };
    }
    case "single_choice": {
      const match = q.options?.find((o) => o.toLowerCase() === v.toLowerCase());
      return match ? { value: match } : { value: v, flag: `${q.id}: "${v}" is not a listed option` };
    }
    default:
      return { value: v };
  }
}

export function stageRows(
  headers: string[],
  rows: string[][],
  mapping: MappingLine[],
  questions: FieldQuestion[],
  startSeq: number,
): { staged: StagedRow[]; flagged: number } {
  const byQ = new Map(questions.map((q) => [q.id, q]));
  const required = questions.filter((q) => q.required !== false).length || questions.length || 1;
  const staged: StagedRow[] = [];
  let flagged = 0;

  rows.forEach((cells, i) => {
    const answers: Record<string, AnswerValue> = {};
    const flags: string[] = [];
    headers.forEach((_, c) => {
      const line = mapping[c];
      if (!line?.question_id) return;
      const { value, flag } = coerce(byQ.get(line.question_id), cells[c] ?? "");
      if (value !== null && value !== "") answers[line.question_id] = value;
      if (flag) flags.push(flag);
      if (line.confidence < 0.6) flags.push(`low confidence on "${line.column}"`);
    });
    const answered = Object.keys(answers).length;
    const completeness = Math.min(1, answered / required);
    if (answered === 0) flags.push("no instrument answers found in this row");
    if (flags.length > 0) flagged += 1;
    staged.push({
      index: i,
      participant_code: `P-${String(startSeq + i + 1).padStart(4, "0")}`,
      answers,
      completeness: Math.round(completeness * 100) / 100,
      flags: [...new Set(flags)],
      include: answered > 0,
    });
  });

  return { staged, flagged };
}

// ── Narrative mapping (sessions, moderator notes, transcripts) ─────────────

function isNarrative(v: unknown): v is StagedNarrative {
  const r = v as StagedNarrative | null;
  return !!r && typeof r.summary === "string" && typeof r.transcript === "string";
}

export async function mapNarrative(
  text: string,
  questions: FieldQuestion[],
  context: { title: string; method: string },
): Promise<StagedNarrative> {
  const out = await deriveJson<StagedNarrative>({
    system: `You are a research operations editor filing a qualitative session that was run outside the system. You never invent content: everything you write must be traceable to the supplied material.

Produce a clean transcript (speaker-labelled where the source allows), a factual summary of what was said, and — only where the material genuinely settles them — answers against the discussion guide's prompts.`,
    user: `SESSION: ${context.title} (${context.method})

DISCUSSION GUIDE PROMPTS:
${questionCatalogue(questions) || "(no guide held — summarise on the material's own terms)"}

MATERIAL:
${text.slice(0, 120_000)}

Return JSON: {"title":"...","summary":"...","transcript":"...","answers":{"prompt_id":"what the room said"},"flags":["anything unclear or missing"]}`,
    validate: isNarrative,
  });
  return { ...out, answers: out.answers ?? {}, flags: out.flags ?? [] };
}

// ── Batch lifecycle ────────────────────────────────────────────────────────

export interface StageArgs {
  supabase: Db;
  studyId: string;
  countryCode: string;
  waveId: string | null;
  collectionId: string | null;
  sessionId: string | null;
  instrument: { id: string; version: number; questions: FieldQuestion[] } | null;
  storagePath: string;
  filename: string;
  mimeType: string;
  userId: string | null;
  /** Force the treatment rather than letting the file decide. */
  expect?: IngestKind;
}

/** Read one uploaded artefact, map it, and park it for review. */
export async function stageArtifact(args: StageArgs): Promise<IngestBatch> {
  const { supabase } = args;
  const { data: file, error: dlErr } = await supabase.storage
    .from("study-artifacts")
    .download(args.storagePath);
  if (dlErr || !file) throw new Error(dlErr?.message ?? "Could not read the uploaded file.");

  const artifact = await extractArtifact(file, args.mimeType, args.filename);
  const questions = args.instrument?.questions ?? [];
  const warnings: string[] = [];

  const treatAs: IngestKind =
    args.expect ?? (artifact.kind === "tabular" && !args.sessionId ? "tabular" : "narrative");

  let mapping: MappingLine[] = [];
  let staged: StagedRow[] | StagedNarrative[] = [];
  let rowCount = 0;
  let flagged = 0;
  let unmapped = 0;

  if (treatAs === "tabular") {
    const grid = parseDelimited(artifact.text);
    if (grid.length < 2) throw new Error("No rows of returns found in that file.");
    const headers = (grid[0] ?? []).map((h) => h.trim());
    const body = grid.slice(1);
    if (questions.length === 0) throw new Error("Draft the instrument before importing returns.");

    const reply = await mapColumns(headers, body, questions);
    mapping = headers.map(
      (h, i) =>
        reply.mapping[i] ?? { column: h, question_id: null, confidence: 0, note: "unmatched" },
    );
    unmapped = mapping.filter((m) => !m.question_id).length;
    for (const n of reply.notes ?? []) warnings.push(n);

    let startSeq = 0;
    if (args.collectionId) {
      const { count } = await supabase
        .from("field_responses")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", args.collectionId);
      startSeq = count ?? 0;
    }
    const res = stageRows(headers, body, mapping, questions, startSeq);
    staged = res.staged;
    flagged = res.flagged;
    rowCount = res.staged.length;

    const covered = new Set(mapping.map((m) => m.question_id).filter(Boolean));
    const missing = questions.filter((q) => !covered.has(q.id));
    if (missing.length > 0) {
      warnings.push(
        `${missing.length} instrument question${missing.length === 1 ? "" : "s"} had no matching column: ${missing
          .slice(0, 6)
          .map((q) => q.id)
          .join(", ")}`,
      );
    }
  } else {
    let title = args.filename.replace(/\.[a-z0-9]+$/i, "");
    let method = "session";
    if (args.sessionId) {
      const { data: s } = await supabase
        .from("field_sessions")
        .select("title,method")
        .eq("id", args.sessionId)
        .maybeSingle();
      if (s) {
        title = (s.title as string) ?? title;
        method = (s.method as string) ?? method;
      }
    }
    const narrative = await mapNarrative(artifact.text, questions, { title, method });
    staged = [narrative];
    rowCount = 1;
    flagged = narrative.flags.length > 0 ? 1 : 0;
    if (artifact.text.trim().length < 200) warnings.push("Very little text was readable in this file.");
  }

  const { data: row, error } = await supabase
    .from("field_ingest_batches")
    .insert({
      study_id: args.studyId,
      country_code: args.countryCode,
      wave_id: args.waveId,
      collection_id: args.collectionId,
      session_id: args.sessionId,
      instrument_id: args.instrument?.id ?? null,
      instrument_version: args.instrument?.version ?? null,
      kind: treatAs,
      status: "staged",
      filename: args.filename,
      storage_path: args.storagePath,
      mime_type: args.mimeType,
      source: "upload",
      mapping: mapping as unknown as Json,
      staged: staged as unknown as Json,
      warnings: warnings as unknown as Json,
      row_count: rowCount,
      mapped_count: mapping.filter((m) => m.question_id).length,
      flagged_count: flagged,
      unmapped_count: unmapped,
      created_by: args.userId,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toBatch(row);
}

export function toBatch(row: unknown): IngestBatch {
  const r = row as Record<string, unknown>;
  return {
    ...(r as unknown as IngestBatch),
    mapping: (r["mapping"] as MappingLine[]) ?? [],
    staged: (r["staged"] as StagedRow[]) ?? [],
    warnings: (r["warnings"] as string[]) ?? [],
  };
}

/** Write a reviewed batch into the fieldwork ledger and the second brain. */
export async function commitBatch(
  supabase: Db,
  batchId: string,
): Promise<{ committed: number; message: string }> {
  const { data: raw, error } = await supabase
    .from("field_ingest_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!raw) throw new Error("That upload is no longer staged.");
  const batch = toBatch(raw);
  if (batch.status === "committed") return { committed: 0, message: "Already filed." };

  if (batch.kind === "tabular") {
    const rows = (batch.staged as StagedRow[]).filter((r) => r.include);
    if (rows.length === 0) throw new Error("Nothing selected to file.");

    let collectionId = batch.collection_id;
    if (!collectionId) {
      const { data: created, error: cErr } = await supabase
        .from("field_collections")
        .insert({
          study_id: batch.study_id,
          country_code: (raw as { country_code: string }).country_code,
          instrument_id: batch.instrument_id,
          instrument_version: batch.instrument_version,
          mode: "imported",
          access: "open",
          status: "open",
        } as never)
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      collectionId = created.id as string;
    }

    let committed = 0;
    for (const r of rows) {
      const { error: iErr } = await supabase.from("field_responses").insert({
        collection_id: collectionId,
        study_id: batch.study_id,
        country_code: (raw as { country_code: string }).country_code,
        participant_code: r.participant_code,
        answers: r.answers as unknown as Json,
        source: "offline",
        instrument_version: batch.instrument_version,
        completion_rate: r.completeness,
        ingest_batch_id: batch.id,
      } as never);
      if (!iErr) committed += 1;
    }

    await supabase
      .from("field_ingest_batches")
      .update({
        status: "committed",
        committed_count: committed,
        committed_at: new Date().toISOString(),
        collection_id: collectionId,
      } as never)
      .eq("id", batch.id);

    try {
      const { buildFieldTag, ingestResponsesToCorpus } = await import("./field-corpus.server");
      const tag = await buildFieldTag(batch.study_id);
      await ingestResponsesToCorpus({
        tag,
        collectionId,
        responses: rows.map((r) => ({
          participant_code: r.participant_code,
          answers: r.answers,
          submitted_at: new Date().toISOString(),
        })),
      });
    } catch {
      /* corpus filing is best-effort; the ledger is the record of truth */
    }

    return {
      committed,
      message: `${committed} return${committed === 1 ? "" : "s"} filed to the fieldwork ledger.`,
    };
  }

  // Narrative → a session's transcript.
  const narrative = (batch.staged as StagedNarrative[])[0];
  if (!narrative) throw new Error("Nothing staged to file.");

  let sessionId = batch.session_id;
  if (!sessionId) {
    const { data: created, error: sErr } = await supabase
      .from("field_sessions")
      .insert({
        study_id: batch.study_id,
        country_code: (raw as { country_code: string }).country_code,
        title: narrative.title || (batch.filename ?? "Imported session"),
        method: "focus_group",
        status: "held",
      } as never)
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);
    sessionId = created.id as string;
  }

  const { error: tErr } = await supabase
    .from("field_sessions")
    .update({
      transcript: narrative.transcript,
      notes: narrative.summary,
      status: "held",
    } as never)
    .eq("id", sessionId);
  if (tErr) throw new Error(tErr.message);

  await supabase
    .from("field_ingest_batches")
    .update({
      status: "committed",
      committed_count: 1,
      committed_at: new Date().toISOString(),
      session_id: sessionId,
    } as never)
    .eq("id", batch.id);

  try {
    const { buildFieldTag, ingestSessionToCorpus } = await import("./field-corpus.server");
    const tag = await buildFieldTag(batch.study_id);
    await ingestSessionToCorpus({
      tag,
      sessionId,
      sessionTitle: narrative.title,
      scheduledAt: null,
      transcript: narrative.transcript,
      notes: narrative.summary,
      participantCodes: [],
    });
  } catch {
    /* best-effort */
  }


  return { committed: 1, message: "Session filed with its transcript and summary." };
}
