// Chamber 07 · Stage 04 · Offline intake.
//
// Fieldwork rarely happens entirely inside one system. A ministry runs the
// questionnaire on paper, an agency fields it in their own tool, a focus group
// is recorded on a phone. This panel is the door back in: drop what came back,
// the chamber reads it, maps it to the instrument of record, and shows the
// mapping for a person to approve before a single return is filed.

import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type {
  IngestBatch,
  MappingLine,
  StagedNarrative,
  StagedRow,
} from "@/lib/personas/field-ingest.server";
import {
  commitIngest,
  discardIngest,
  listIngestBatches,
  reviseIngest,
  stageIngest,
} from "@/lib/personas/field-ingest.functions";
import { signUploadUrl } from "@/lib/personas/parse-upload.functions";

interface Props {
  studyId: string;
  countryCode: string;
  waveId: string;
  collectionId?: string | null;
  sessionId?: string | null;
  expect: "tabular" | "narrative";
  questionIds: string[];
  refresh: () => void;
}

export function IngestPanel({
  studyId,
  countryCode,
  waveId,
  collectionId,
  sessionId,
  expect,
  questionIds,
  refresh,
}: Props) {
  const [note, setNote] = useState<string | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const signFn = useServerFn(signUploadUrl);
  const stageFn = useServerFn(stageIngest);
  const listFn = useServerFn(listIngestBatches);
  const reviseFn = useServerFn(reviseIngest);
  const commitFn = useServerFn(commitIngest);
  const discardFn = useServerFn(discardIngest);

  const batches = useQuery({
    queryKey: ["field-ingest", studyId, waveId],
    queryFn: () => listFn({ data: { studyId, waveId } }),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let staged = 0;
      for (const file of files) {
        setBusyFile(file.name);
        const { path, token, signedUrl } = await signFn({
          data: { countryCode, filename: file.name },
        });
        const { error } = await supabase.storage
          .from("study-artifacts")
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (error && signedUrl) {
          await fetch(signedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });
        }
        const batch = await stageFn({
          data: {
            studyId,
            waveId,
            collectionId: collectionId ?? null,
            sessionId: sessionId ?? null,
            storagePath: path,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            expect,
          },
        });
        setOpen(batch.id);
        staged += 1;
      }
      return staged;
    },
    onSuccess: (n) => {
      setBusyFile(null);
      setNote(`${n} file${n === 1 ? "" : "s"} read and staged for your review.`);
      void batches.refetch();
    },
    onError: (e: Error) => {
      setBusyFile(null);
      setNote(e.message);
    },
  });

  const commit = useMutation({
    mutationFn: async (batchId: string) => (await commitFn({ data: { batchId } })).message,
    onSuccess: (m) => {
      setNote(m);
      setOpen(null);
      void batches.refetch();
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const discard = useMutation({
    mutationFn: async (batchId: string) => {
      await discardFn({ data: { batchId } });
      return "Upload discarded.";
    },
    onSuccess: (m) => {
      setNote(m);
      setOpen(null);
      void batches.refetch();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const revise = useMutation({
    mutationFn: async (args: { batchId: string; mapping?: MappingLine[]; staged?: StagedRow[] }) => {
      await reviseFn({
        data: {
          batchId: args.batchId,
          ...(args.mapping ? { mapping: args.mapping } : {}),
          ...(args.staged ? { staged: args.staged as unknown as Record<string, unknown>[] } : {}),
        },
      });
      return "Mapping updated.";
    },
    onSuccess: () => void batches.refetch(),
    onError: (e: Error) => setNote(e.message),
  });

  const pending = (batches.data ?? []).filter((b) => b.status === "staged");
  const filed = (batches.data ?? []).filter((b) => b.status === "committed");

  return (
    <div className="border border-line-200 bg-paper-50">
      <div className="border-b border-line-100 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Collected elsewhere
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
          {expect === "tabular"
            ? "Drop a spreadsheet, an export from another survey tool, or photographs of completed paper forms. The chamber reads them, matches each column to this instrument, and shows you the mapping before anything is filed."
            : "Drop the recording, transcript or moderator's notes. The chamber transcribes, summarises and files the session against its discussion guide once you approve."}
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).slice(0, 5);
            if (files.length) upload.mutate(files);
          }}
          className="mt-3 flex flex-col items-center justify-center border border-dashed border-line-200 bg-paper-0 p-5 text-center"
        >
          <UploadCloud className="h-5 w-5 text-ink-400" />
          <p className="mt-2 text-[13px] text-ink-700">Drop files here</p>
          <button
            type="button"
            className="btn-secondary mt-2"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <>
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                Reading {busyFile}…
              </>
            ) : (
              <>
                <FileUp className="mr-1 inline h-3.5 w-3.5" />
                Choose files
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={
              expect === "tabular"
                ? ".csv,.tsv,.txt,.json,.xlsx,.pdf,image/*"
                : "audio/*,video/*,.txt,.md,.docx,.pdf"
            }
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 5);
              if (files.length) upload.mutate(files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {pending.length > 0 ? (
        <ul className="divide-y divide-line-100">
          {pending.map((b) => (
            <li key={b.id} className="p-3">
              <button
                type="button"
                className="flex w-full flex-wrap items-center gap-2 text-left"
                onClick={() => setOpen(open === b.id ? null : b.id)}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                <span className="text-[13px] text-ink-950">{b.filename}</span>
                <span className="font-mono text-[11px] tabular-nums text-ink-600">
                  {b.kind === "tabular"
                    ? `${b.row_count} rows · ${b.mapped_count} columns mapped · ${b.flagged_count} to check`
                    : "session ready to review"}
                </span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {open === b.id ? "hide" : "review"}
                </span>
              </button>

              {open === b.id ? (
                <StagingReview
                  batch={b}
                  questionIds={questionIds}
                  onMapping={(mapping) => revise.mutate({ batchId: b.id, mapping })}
                  onRows={(staged) => revise.mutate({ batchId: b.id, staged })}
                  onCommit={() => commit.mutate(b.id)}
                  onDiscard={() => discard.mutate(b.id)}
                  busy={commit.isPending || discard.isPending || revise.isPending}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {filed.length > 0 ? (
        <ul className="divide-y divide-line-100 border-t border-line-100">
          {filed.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 p-2 text-[12px]">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ink-500" />
              <span className="truncate text-ink-800">{b.filename}</span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-500">
                {b.committed_count} filed
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {note ? <p className="border-t border-line-100 p-2 text-[12px] text-ink-700">{note}</p> : null}
    </div>
  );
}

function StagingReview({
  batch,
  questionIds,
  onMapping,
  onRows,
  onCommit,
  onDiscard,
  busy,
}: {
  batch: IngestBatch;
  questionIds: string[];
  onMapping: (m: MappingLine[]) => void;
  onRows: (r: StagedRow[]) => void;
  onCommit: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  const narrative = batch.kind === "narrative" ? (batch.staged as StagedNarrative[])[0] : null;
  const rows = batch.kind === "tabular" ? (batch.staged as StagedRow[]) : [];
  const included = rows.filter((r) => r.include).length;

  return (
    <div className="mt-3 space-y-3">
      {batch.warnings.length > 0 ? (
        <ul className="border border-line-200 bg-paper-0 p-2">
          {batch.warnings.map((w, i) => (
            <li key={i} className="text-[12px] text-ink-700">
              · {w}
            </li>
          ))}
        </ul>
      ) : null}

      {batch.kind === "tabular" ? (
        <>
          <div className="overflow-x-auto border border-line-200 bg-paper-0">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line-100 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  <th className="p-2">Uploaded column</th>
                  <th className="p-2">Answers question</th>
                  <th className="p-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {batch.mapping.map((m, i) => (
                  <tr key={i} className="border-b border-line-100 last:border-0">
                    <td className="max-w-[18rem] truncate p-2 text-ink-800">{m.column}</td>
                    <td className="p-2">
                      <select
                        value={m.question_id ?? ""}
                        className="w-full border border-line-200 bg-paper-0 p-1 text-[12px] focus:border-ink-950 focus:outline-none"
                        onChange={(e) => {
                          const next = batch.mapping.map((line, j) =>
                            j === i
                              ? {
                                  ...line,
                                  question_id: e.target.value || null,
                                  confidence: 1,
                                  note: "set by the researcher",
                                }
                              : line,
                          );
                          onMapping(next);
                        }}
                      >
                        <option value="">— not part of this instrument —</option>
                        {questionIds.map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 font-mono tabular-nums text-ink-600">
                      {Math.round(m.confidence * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="border border-line-200 bg-paper-0">
            <summary className="cursor-pointer p-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-600">
              Returns to file · {included} of {rows.length}
            </summary>
            <ul className="max-h-64 divide-y divide-line-100 overflow-y-auto">
              {rows.map((r) => (
                <li key={r.index} className="flex flex-wrap items-center gap-2 p-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) =>
                      onRows(
                        rows.map((x) =>
                          x.index === r.index ? { ...x, include: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  <span className="font-mono text-ink-700">{r.participant_code}</span>
                  <span className="font-mono tabular-nums text-ink-500">
                    {Math.round(r.completeness * 100)}% complete
                  </span>
                  {r.flags.length > 0 ? (
                    <span className="text-ink-600">· {r.flags.join("; ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : narrative ? (
        <div className="border border-line-200 bg-paper-0 p-2">
          <p className="text-[13px] font-medium text-ink-950">{narrative.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{narrative.summary}</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-ink-600">
              Transcript
            </summary>
            <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap text-[12px] text-ink-700">
              {narrative.transcript}
            </p>
          </details>
          {narrative.flags.length > 0 ? (
            <p className="mt-2 text-[12px] text-ink-600">· {narrative.flags.join("; ")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || (batch.kind === "tabular" && included === 0)}
          onClick={onCommit}
        >
          {busy ? "Filing…" : `File ${batch.kind === "tabular" ? `${included} returns` : "this session"}`}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onDiscard}>
          <Trash2 className="mr-1 inline h-3.5 w-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
}
